"""
Lambda function to trigger the researcher's public Function URL.
Called by EventBridge Scheduler on a schedule.
"""
import os
import urllib.request
import json

# The researcher Lambda's own timeout is 300s. Wait slightly longer than that so
# a slow-but-successful run is still reported as a success, then return normally.
#
# This must also stay comfortably below this function's own Lambda timeout. If
# the Lambda hard-times-out instead of returning, EventBridge Scheduler counts
# the invocation as failed and retries it - and every retry is another full
# research run against Bedrock.
REQUEST_TIMEOUT_SECONDS = 310


def handler(event, context):
    """Trigger the research endpoint on the researcher Lambda."""

    researcher_url = os.environ.get('APP_RUNNER_URL')
    if not researcher_url:
        raise ValueError("APP_RUNNER_URL environment variable not set")

    # Remove any protocol if included
    if researcher_url.startswith('https://'):
        researcher_url = researcher_url.replace('https://', '')
    elif researcher_url.startswith('http://'):
        researcher_url = researcher_url.replace('http://', '')

    url = f"https://{researcher_url}/research"

    try:
        # Create POST request with empty JSON body (agent will pick topic)
        data = json.dumps({}).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            method='POST',
            headers={'Content-Type': 'application/json'}
        )

        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            result = response.read().decode('utf-8')
            print(f"Research triggered successfully: {result}")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Research triggered successfully',
                    'result': result
                })
            }
    except Exception as e:
        # Deliberately returned, not raised. A raise here would be retried by
        # EventBridge Scheduler, and the researcher may well have completed (and
        # billed) already - the next scheduled run picks a fresh topic anyway.
        print(f"Error triggering research: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
