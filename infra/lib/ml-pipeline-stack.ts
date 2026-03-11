import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import * as path from "path";

export class MlPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const databaseUrl = this.node.tryGetContext("databaseUrl");
    if (!databaseUrl) {
      throw new Error(
        'Missing required context: databaseUrl. Deploy with: cdk deploy -c databaseUrl="postgresql://..."'
      );
    }

    const fn = new lambda.DockerImageFunction(this, "MlPipelineFn", {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../ml_pipeline")
      ),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      architecture: lambda.Architecture.X86_64,
      environment: {
        DATABASE_URL: databaseUrl,
      },
    });

    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    const rule = new events.Rule(this, "NightlyRun", {
      schedule: events.Schedule.expression("cron(0 14 * * ? *)"),
    });

    rule.addTarget(
      new targets.LambdaFunction(fn, {
        event: events.RuleTargetInput.fromObject({ run_all: true }),
      })
    );

    new cdk.CfnOutput(this, "FunctionUrl", {
      value: fnUrl.url,
    });

    new cdk.CfnOutput(this, "FunctionName", {
      value: fn.functionName,
    });
  }
}
