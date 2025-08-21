#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Ec2Stack } from '../lib/ec2-stack';

const app = new cdk.App();

// Usa el nombre del proyecto en el ID del stack:
new Ec2Stack(app, 'SIMPLE_CDK_CREATE_EC2', {
  // Opcional: fija env si quieres concretar account/region
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

