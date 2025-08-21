# SIMPLE_CDK_CREATE_EC2

An **AWS CDK v2** application in **TypeScript** that provisions an **EC2 instance** with:

- Configurable **Instance Type**, **VPC/Subnet**, **Security Groups**, **IAM Role**, and optional **SSH key pair**
- A **user-data** bootstrap script (`user-data/bootstrap.sh`)
- **Dynamic tags** loaded from environment variables prefixed with `TAG_`
- Safer defaults (IMDSv2 required, encrypted gp3 root volume, detailed monitoring)
- Ability to deploy **multiple independent servers** using `--context stackName=<NAME>`

---

## 📁 Repository structure

```
bin/
  simple_cdk_create_ec2.ts       # CDK app entrypoint (reads --context stackName=...)
lib/
  ec2-stack.ts                   # Main stack (reads .env and provisions the EC2)
user-data/
  bootstrap.sh                   # First-boot initialization commands
cdk.json
cdk.context.json                 # Generated after first synth/lookup (commit it)
package.json
tsconfig.json
.env.example                     # Template for environment variables
```

---

## ✅ Prerequisites

### 1) System Packages

#### CentOS / RHEL / AlmaLinux / Rocky Linux
```bash
# Node.js 20 LTS (recommended)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Install build tools if missing
sudo yum groupinstall -y "Development Tools"
```

#### Debian / Ubuntu
```bash
# Node.js 20 LTS (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential
```

Verify installation:
```bash
node -v   # >= 18.x (20.x LTS recommended)
npm -v
```

### 2) AWS CDK CLI
Install the AWS CDK CLI globally, or just use `npx`:
```bash
npm install -g aws-cdk@2.208.0   # optional
cdk --version
```

### 3) AWS Credentials
Ensure AWS credentials are configured before deploying:
- `aws configure` (AWS CLI), or environment variables:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
- `~/.aws/credentials` file
- An IAM role if deploying from within AWS (CloudShell/EC2)

**Deployer permissions (minimum practical):**
- `cloudformation:*`
- `ec2:*` (or least-privilege subset covering instance, subnets, SGs, describe, etc.)
- `iam:PassRole`

If you will manage the instance with **SSM**, the role must include `AmazonSSMManagedInstanceCore`.

---

## ⚙️ Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/SIMPLE_CDK_CREATE_EC2.git
cd SIMPLE_CDK_CREATE_EC2
npm install
```

Bootstrap your AWS environment (only once per account/region):
```bash
npx cdk bootstrap
```

---

## 🔧 Configuration

### 1) `.env` file

Create a `.env` file in the project root. Example:

```ini
VPC_ID=vpc-1234567890abcdef0
SUBNET_ID=subnet-0123456789abcdef0
SUBNET_AZ=us-east-1a
INSTANCE_TYPE=t3.micro
ROLE_NAME=EC2InstanceRole
AMI_ID=ami-0123456789abcdef0
SECURITY_GROUP_IDS=sg-0123456789abcdef0,sg-0abcdef1234567890

# Optional if using SSH
KEY_NAME=my-keypair

# Tags (any number allowed)
TAG_Environment=qa
TAG_Project=system
TAG_Function=TaskServer
TAG_Name=GOS_TaskServer-QA
```

> Any environment variable starting with `TAG_` will be converted into an EC2 tag.

### 2) User data script

Edit `user-data/bootstrap.sh` with commands to run on first boot.

---

## 🚀 Deploy

Deploy with a unique **stack name** (required to avoid replacing a previous instance):

```bash
npx cdk deploy --context stackName=MyFirstServer
```

To deploy another EC2 instance with a different name:

```bash
npx cdk deploy --context stackName=MySecondServer
```

If you omit `--context stackName=...`, deploying twice will **replace the same instance**.

---

## 🛑 Destroy

To remove a deployed stack:

```bash
npx cdk destroy --context stackName=MyFirstServer
```

---

## 📌 Notes

- Default limit: up to **50 tags per resource** (AWS restriction).
- Tags with prefix `aws:` are ignored (reserved by AWS).
- `KEY_NAME` is optional — if omitted, SSH access is disabled, but you can still connect via **SSM Session Manager** (recommended).

---

## 📜 License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

