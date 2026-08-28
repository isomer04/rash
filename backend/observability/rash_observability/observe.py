"""LangFuse observability for the Rash agents.

A single context manager, shared by all five agents. Each agent previously kept
its own copy of this file; the copies drifted, and two of them stopped yielding
the client at all, so `with observe() as client:` silently produced None even
when LangFuse was configured.
"""

import logging
import os
import time
from contextlib import contextmanager

# Root logger, so records surface in CloudWatch under Lambda.
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Lambda freezes the execution environment the moment the handler returns, which
# can cut off LangFuse's in-flight export. Sleeping before returning gives the
# flush time to land. It is billed wall-clock on every invocation, so it is the
# first thing to tune if agent cost matters more than trace completeness.
DEFAULT_FLUSH_SECONDS = 10


@contextmanager
def observe(service_name: str, flush_seconds: float = DEFAULT_FLUSH_SECONDS):
    """Instrument the OpenAI Agents SDK and flush traces on exit.

    Yields the LangFuse client when observability is configured and set-up
    succeeded, and None otherwise. Callers that only need instrumentation can
    ignore the yielded value:

        with observe("rash_planner_agent"):
            result = await Runner.run(agent, input=task)

    Callers that record their own spans or events use it:

        with observe("rash_reporter_agent") as client:
            if client:
                client.create_event(name="Judge Event", ...)

    Never raises: a misconfigured or unreachable LangFuse degrades to None so
    that telemetry problems cannot take an agent down.
    """
    logger.info("🔍 Observability: Checking configuration...")

    has_langfuse = bool(os.getenv("LANGFUSE_SECRET_KEY"))
    has_openai = bool(os.getenv("OPENAI_API_KEY"))

    logger.info(f"🔍 Observability: LANGFUSE_SECRET_KEY exists: {has_langfuse}")
    logger.info(f"🔍 Observability: OPENAI_API_KEY exists: {has_openai}")

    if not has_langfuse:
        logger.info("🔍 Observability: LangFuse not configured, skipping setup")
        yield None
        return

    if not has_openai:
        logger.warning("⚠️  Observability: OPENAI_API_KEY not set, traces may not export")

    langfuse_client = None

    try:
        logger.info("🔍 Observability: Setting up LangFuse...")

        import logfire
        from langfuse import get_client

        # Route the OpenAI Agents SDK's spans through logfire into LangFuse,
        # without sending anything to Logfire's own cloud.
        logfire.configure(service_name=service_name, send_to_logfire=False)
        logger.info("✅ Observability: Logfire configured")

        logfire.instrument_openai_agents()
        logger.info("✅ Observability: OpenAI Agents SDK instrumented")

        langfuse_client = get_client()
        logger.info("✅ Observability: LangFuse client initialized")

        # Blocking network call; useful signal in logs, but never fatal.
        try:
            auth_result = langfuse_client.auth_check()
            logger.info(
                f"✅ Observability: LangFuse authentication check passed "
                f"(result: {auth_result})"
            )
        except Exception as auth_error:
            logger.warning(
                f"⚠️  Observability: Auth check failed but continuing: {auth_error}"
            )

        logger.info("🎯 Observability: Setup complete - traces will be sent to LangFuse")

    except ImportError as e:
        logger.error(f"❌ Observability: Missing required package: {e}")
        langfuse_client = None
    except Exception as e:
        logger.error(f"❌ Observability: Setup failed: {e}")
        langfuse_client = None

    try:
        yield langfuse_client
    finally:
        if langfuse_client:
            try:
                logger.info("🔍 Observability: Flushing traces to LangFuse...")
                langfuse_client.flush()
                langfuse_client.shutdown()

                logger.info(
                    f"🔍 Observability: Waiting {flush_seconds:g} seconds for flush "
                    f"to complete..."
                )
                time.sleep(flush_seconds)

                logger.info("✅ Observability: Traces flushed successfully")
            except Exception as e:
                logger.error(f"❌ Observability: Failed to flush traces: {e}")
        else:
            logger.debug("🔍 Observability: No client to flush")
