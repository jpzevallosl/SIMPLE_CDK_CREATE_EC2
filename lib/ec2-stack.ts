import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as fs from 'fs';
import * as path from 'path';

// Cargar variables de entorno
require('dotenv').config();

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') throw new Error(`Variable ${key} not found in .env`);
  return value.trim();
}

function getOptionalEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value || value.trim() === '') return undefined;
  return value.trim();
}

// Parsear tags desde variables que empiezan con TAG_
// Reglas: ignora valores vacíos, valida longitudes, prohíbe "aws:", último gana.
function getDynamicTags(prefix = 'TAG_'): { key: string; value: string }[] {
  const rawEntries = Object.entries(process.env)
    .filter(([k, v]) => k.startsWith(prefix) && (v ?? '').trim() !== '');

  const seen: Record<string, string> = {};
  for (const [rawKey, rawVal] of rawEntries) {
    const key = rawKey.substring(prefix.length).trim();
    const value = String(rawVal).trim();
    if (!key) continue;
    if (key.length > 128) continue;
    if (value.length > 256) continue;
    if (key.toLowerCase().startsWith('aws:')) continue;
    seen[key] = value;
  }
  return Object.entries(seen).slice(0, 50).map(([key, value]) => ({ key, value }));
}

// Permite 'ami-...' o alias SSM (al2023-x86_64 | al2023-arm64)
function resolveMachineImage(scope: cdk.Stack, amiIdOrAlias: string): ec2.IMachineImage {
  if (amiIdOrAlias.startsWith('ami-')) {
    return ec2.MachineImage.genericLinux({ [scope.region]: amiIdOrAlias });
  }
  const aliases: Record<string, string> = {
    'al2023-x86_64': '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64',
    'al2023-arm64': '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64',
  };
  const param = aliases[amiIdOrAlias];
  if (!param) {
    throw new Error(`AMI_ID must be an 'ami-...' or one of: ${Object.keys(aliases).join(', ')}`);
  }
  return ec2.MachineImage.fromSsmParameter(param);
}

export class Ec2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcId        = getRequiredEnv('VPC_ID');
    const subnetId     = getRequiredEnv('SUBNET_ID');
    const subnetAz     = getRequiredEnv('SUBNET_AZ');
    const instanceType = new ec2.InstanceType(getRequiredEnv('INSTANCE_TYPE'));
    const roleName     = getRequiredEnv('ROLE_NAME');
    const amiSetting   = getRequiredEnv('AMI_ID');

    // KEY_NAME opcional (usa SSM si no quieres SSH)
    const keyName = getOptionalEnv('KEY_NAME');

    // Seguridad: valida que la AZ pertenezca a la región del stack
    if (!subnetAz.startsWith(this.region)) {
      throw new Error(`SUBNET_AZ (${subnetAz}) no pertenece a la región del stack (${this.region}).`);
    }

    const sgIds = (getRequiredEnv('SECURITY_GROUP_IDS') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (sgIds.length === 0) {
      throw new Error('SECURITY_GROUP_IDS must have at least one sg-xxxxxxxx id');
    }

    // Cargar user-data
    const userDataFile = path.join(__dirname, '../user-data/bootstrap.sh');
    const userData = fs.readFileSync(userDataFile, 'utf8');

    // Recursos existentes
    const vpc = ec2.Vpc.fromLookup(this, 'SelectedVPC', { vpcId });
    const subnet = ec2.Subnet.fromSubnetAttributes(this, 'SelectedSubnet', {
      subnetId,
      availabilityZone: subnetAz,
    });
    const securityGroups = sgIds.map((sgId, idx) =>
      ec2.SecurityGroup.fromSecurityGroupId(this, `SG${idx}`, sgId)
    );

    // Rol existente (debe tener trust para ec2.amazonaws.com)
    const ec2Role = iam.Role.fromRoleName(this, 'InstanceRole', roleName);

    // Props base para la instancia
    const instanceProps: ec2.InstanceProps = {
      vpc,
      vpcSubnets: { subnets: [subnet] },
      instanceType,
      machineImage: resolveMachineImage(this, amiSetting),
      role: ec2Role,
      securityGroup: securityGroups[0],
      userData: ec2.UserData.custom(userData),

      // Endurecimiento básico
      requireImdsv2: true,
      detailedMonitoring: true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
          }),
        },
      ],
      // creditSpecification: { cpuCredits: ec2.CpuCredits.UNLIMITED },
    };

    // Crear instancia (agrega keyName sólo si está definido)
    const ec2Instance = new ec2.Instance(this, 'CustomEC2', {
      ...instanceProps,
      ...(keyName ? { keyName } : {}),
    });

    // SGs adicionales
    for (let i = 1; i < securityGroups.length; i++) {
      ec2Instance.addSecurityGroup(securityGroups[i]);
    }

    // Tags dinámicos (solo la instancia)
    getDynamicTags().forEach(tag => cdk.Tags.of(ec2Instance).add(tag.key, tag.value));
  }
}

