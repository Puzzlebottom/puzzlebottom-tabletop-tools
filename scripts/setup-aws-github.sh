#!/usr/bin/env bash
set -euo pipefail

AWS_ACCOUNT_ID="196283272028"
AWS_REGION="us-east-1"
GITHUB_OWNER="Puzzlebottom"
GITHUB_REPO="aws-step-function-test"
ROLE_NAME="github-actions-deploy-role"
OIDC_PROVIDER_URL="token.actions.githubusercontent.com"

echo "=== Step 1: Create GitHub OIDC Identity Provider in AWS ==="

OIDC_ARN=$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?ends_with(Arn, '/${OIDC_PROVIDER_URL}')].Arn" \
  --output text 2>/dev/null || true)

if [ -n "$OIDC_ARN" ] && [ "$OIDC_ARN" != "None" ]; then
  echo "OIDC provider already exists: $OIDC_ARN"
else
  THUMBPRINT=$(openssl s_client -connect "${OIDC_PROVIDER_URL}:443" -servername "$OIDC_PROVIDER_URL" </dev/null 2>/dev/null \
    | openssl x509 -fingerprint -sha1 -noout 2>/dev/null \
    | cut -d= -f2 | tr -d : | tr '[:upper:]' '[:lower:]')

  OIDC_ARN=$(aws iam create-open-id-connect-provider \
    --url "https://${OIDC_PROVIDER_URL}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "$THUMBPRINT" \
    --query "OpenIDConnectProviderArn" \
    --output text)
  echo "Created OIDC provider: $OIDC_ARN"
fi

echo ""
echo "=== Step 2: Create IAM Deployment Role ==="

TRUST_POLICY=$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER_URL}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_PROVIDER_URL}:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "${OIDC_PROVIDER_URL}:sub": "repo:${GITHUB_OWNER}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
POLICY
)

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" \
  --query "Role.Arn" --output text 2>/dev/null || true)

if [ -n "$ROLE_ARN" ] && [ "$ROLE_ARN" != "None" ]; then
  echo "Role already exists: $ROLE_ARN"
  echo "Updating trust policy..."
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY"
else
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "GitHub Actions OIDC role for ${GITHUB_OWNER}/${GITHUB_REPO}" \
    --query "Role.Arn" \
    --output text)
  echo "Created role: $ROLE_ARN"
fi

DEPLOY_POLICY=$(cat <<'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CDKDeployPermissions",
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "dynamodb:*",
        "sqs:*",
        "events:*",
        "appsync:*",
        "cognito-idp:*",
        "amplify:*",
        "states:*",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:CreateServiceLinkedRole",
        "s3:*",
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ssm:DeleteParameter",
        "logs:*",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "sts:AssumeRole",
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    }
  ]
}
POLICY
)

POLICY_NAME="cdk-deploy-policy"

echo "Attaching deployment policy..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$DEPLOY_POLICY"
echo "Policy attached."

echo ""
echo "=== Step 3: Store Role ARN in GitHub Actions Secrets ==="

echo "$ROLE_ARN" | gh secret set AWS_ROLE_ARN --repo "${GITHUB_OWNER}/${GITHUB_REPO}"
echo "Stored AWS_ROLE_ARN in GitHub secrets."

echo ""
echo "=== Step 4: Store GitHub PAT in AWS Secrets Manager ==="

EXISTING_SECRET=$(aws secretsmanager describe-secret --secret-id github-token 2>/dev/null || true)

if [ -n "$EXISTING_SECRET" ]; then
  echo "Secret 'github-token' already exists in Secrets Manager."
  read -rp "Update it with a new token? (y/N): " UPDATE_TOKEN
  if [[ "$UPDATE_TOKEN" =~ ^[Yy]$ ]]; then
    read -rsp "Paste your GitHub Personal Access Token: " GITHUB_PAT
    echo ""
    aws secretsmanager update-secret \
      --secret-id github-token \
      --secret-string "$GITHUB_PAT"
    echo "Updated secret."
  else
    echo "Skipping."
  fi
else
  read -rsp "Paste your GitHub Personal Access Token (needs 'repo' scope): " GITHUB_PAT
  echo ""
  aws secretsmanager create-secret \
    --name github-token \
    --description "GitHub PAT for Amplify source code access" \
    --secret-string "$GITHUB_PAT" \
    --region "$AWS_REGION"
  echo "Created secret 'github-token' in Secrets Manager."
fi

echo ""
echo "=== Step 5: Create GitHub Environments ==="

for ENV_NAME in development staging production; do
  gh api --method PUT "repos/${GITHUB_OWNER}/${GITHUB_REPO}/environments/${ENV_NAME}" \
    --silent 2>/dev/null || true
  echo "Created environment: ${ENV_NAME}"
done

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Summary:"
echo "  OIDC Provider: $OIDC_ARN"
echo "  IAM Role:      $ROLE_ARN"
echo "  GitHub Secret:  AWS_ROLE_ARN (set)"
echo "  AWS Secret:     github-token (set)"
echo "  Environments:   development, staging, production"
echo ""
echo "Next steps:"
echo "  1. Run: cd infrastructure && npx cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}"
echo "  2. Create the 'development' and 'staging' branches"
echo "  3. Push to 'development' to trigger your first deploy"
