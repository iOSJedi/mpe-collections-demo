#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MlPipelineStack } from "../lib/ml-pipeline-stack";

const app = new cdk.App();

new MlPipelineStack(app, "JcTpoMlPipelineStack", {
  env: {
    region: "ap-southeast-1",
  },
});
