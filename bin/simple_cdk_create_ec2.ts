#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Ec2Stack } from '../lib/ec2-stack';

const app = new cdk.App();

// Lee el nombre del stack desde contexto CLI, o usa 'Ec2Stack' por defecto
const stackName = app.node.tryGetContext('stackName') || 'Ec2Stack';

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

new Ec2Stack(app, stackName, {
  env: { account, region },
});
