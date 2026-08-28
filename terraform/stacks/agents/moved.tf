# State migration for the agent-lambda module extraction.
#
# The five agent Lambdas were previously five hand-written resource blocks.
# These blocks tell Terraform the resources moved into module instances rather
# than being destroyed and recreated. `terraform plan` must report
# "0 to add, 0 to change, 0 to destroy" after this refactor.
#
# Safe to delete once every environment has applied a plan containing them.

moved {
  from = aws_lambda_function.planner
  to   = module.agents["planner"].aws_lambda_function.this
}

moved {
  from = aws_cloudwatch_log_group.agent_logs["planner"]
  to   = module.agents["planner"].aws_cloudwatch_log_group.this
}

moved {
  from = aws_lambda_function.tagger
  to   = module.agents["tagger"].aws_lambda_function.this
}

moved {
  from = aws_cloudwatch_log_group.agent_logs["tagger"]
  to   = module.agents["tagger"].aws_cloudwatch_log_group.this
}

moved {
  from = aws_lambda_function.reporter
  to   = module.agents["reporter"].aws_lambda_function.this
}

moved {
  from = aws_cloudwatch_log_group.agent_logs["reporter"]
  to   = module.agents["reporter"].aws_cloudwatch_log_group.this
}

moved {
  from = aws_lambda_function.charter
  to   = module.agents["charter"].aws_lambda_function.this
}

moved {
  from = aws_cloudwatch_log_group.agent_logs["charter"]
  to   = module.agents["charter"].aws_cloudwatch_log_group.this
}

moved {
  from = aws_lambda_function.retirement
  to   = module.agents["retirement"].aws_lambda_function.this
}

moved {
  from = aws_cloudwatch_log_group.agent_logs["retirement"]
  to   = module.agents["retirement"].aws_cloudwatch_log_group.this
}

