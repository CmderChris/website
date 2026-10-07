# Deploying the website to AWS

End-to-end checklist for hosting this site on AWS (S3 + CloudFront) under your Namecheap domain,
with GitHub Actions deploying automatically whenever something is merged to `main`.

```
Namecheap (registrar) --NS--> Route 53 (DNS) --> CloudFront (CDN + HTTPS) --> private S3 bucket
                                                       ^
GitHub Actions (on merge to main): build -> sync to S3 -> invalidate CloudFront
```

Everything in AWS is created by one CloudFormation template, [`infra/site.yaml`](../infra/site.yaml).
The deploy pipeline is [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml); pull
requests get a lint and build check from [`ci.yml`](../.github/workflows/ci.yml).

Rough cost for a personal site: about $0.50/month for the Route 53 hosted zone, plus pennies for S3 and
CloudFront at low traffic.

## Before you start

- [ ] An AWS account, and you can sign in to the console with an admin-level user.
- [ ] Your domain is registered at Namecheap and you can sign in there.
- [ ] You have admin access to the GitHub repo `CmderChris/website`.
- [ ] The workflow files and `infra/site.yaml` are on a branch (not yet merged to `main`).

Use **N. Virginia (us-east-1)** for every AWS step below. CloudFront only accepts certificates
from that region, and the template keeps everything in one place.

---

## Step 1: Create the Route 53 hosted zone

1. AWS console > **Route 53** > **Hosted zones** > **Create hosted zone**.
2. **Domain name:** your domain, e.g. `example.com` (no `www`).
3. **Type:** Public hosted zone. Click **Create hosted zone**.
4. Open the zone. Note two things:
   - The **Hosted zone ID** (like `Z0123456789ABCDEFGHIJ`). You need it in Step 3.
   - The four **NS records** in the zone's `NS` record, e.g.
     `ns-123.awsdns-45.com`, `ns-678.awsdns-90.net`, `ns-111.awsdns-22.org`, `ns-333.awsdns-44.co.uk`.

## Step 2: Point Namecheap at Route 53

1. Namecheap > **Domain List** > **Manage** next to your domain.
2. On the **Domain** tab, find **Nameservers** and change the dropdown from *Namecheap BasicDNS* to
   **Custom DNS**.
3. Add the four Route 53 nameservers from Step 1. Leave off the trailing dot. Click the green
   checkmark to save.
4. If **Advanced DNS > DNSSEC** is turned on for the domain, turn it off. Otherwise the domain can stop
   resolving after the change.
5. Wait for propagation (usually minutes, sometimes a few hours). Check it:

   ```
   nslookup -type=NS example.com
   ```

   Don't continue until the answer lists the `awsdns` nameservers. If you deploy the stack too early,
   certificate validation hangs until the nameservers switch over.

Any old DNS records you had in Namecheap stop being used. If you had email or other records there,
recreate them in Route 53 before switching.

## Step 3: Deploy the CloudFormation stack

1. Check whether your AWS account already has GitHub's OIDC provider: **IAM** > **Identity providers**.
   - If you see `token.actions.githubusercontent.com`, you will set `CreateGitHubOidcProvider` to
     `false`.
   - If the list is empty (a new account), leave it `true`.
2. **CloudFormation** (region **us-east-1**) > **Create stack** > **With new resources (standard)**.
3. **Upload a template file** > choose `infra/site.yaml` > **Next**.
4. **Stack name:** `website`. Fill in the parameters:

   | Parameter | Value |
   | --- | --- |
   | `DomainName` | your apex domain, e.g. `example.com` |
   | `HostedZoneId` | the ID from Step 1 |
   | `GitHubRepo` | `CmderChris/website` (default) |
   | `GitHubBranch` | `main` (default) |
   | `CreateGitHubOidcProvider` | `true`, or `false` per the check in item 1 |

5. **Next** through the options page. On the review page, tick **I acknowledge that AWS CloudFormation
   might create IAM resources**, then **Submit**.
6. Wait for `CREATE_COMPLETE`. This takes roughly 10 to 20 minutes, mostly certificate validation and
   CloudFront. Refresh the **Events** tab to watch progress.
7. Open the **Outputs** tab and keep it open for Step 4. You need three values:
   - `BucketName`
   - `DistributionId`
   - `DeployRoleArn`

If the stack fails, see [Troubleshooting](#troubleshooting). A failed first creation rolls back
automatically; delete the failed stack and try again after fixing the cause.

## Step 4: Add the GitHub secrets

GitHub repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.
Add these three exact names:

| Secret | Value (from the stack Outputs) |
| --- | --- |
| `AWS_ROLE_ARN` | `DeployRoleArn` |
| `S3_BUCKET` | `BucketName` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `DistributionId` |

None of these are credentials. The deploy role is assumed through OIDC, so there are no AWS access keys
stored in GitHub.

## Step 5: Merge to `main` and run the first deploy

1. Open a pull request with the workflow files and `infra/site.yaml`. The **CI** workflow runs lint and
   build on it. Confirm it passes.
2. Merge the PR. The **Deploy** workflow starts on the push to `main`.
3. Watch it in GitHub > **Actions**. It runs lint, build, uploads to S3, and invalidates CloudFront.
   A green run means the site is live.
4. Open `https://example.com` (your domain) and `https://www.example.com`. The 3D scene should load,
   including the model and textures from `/pip-walk/`.

## Step 6: Protect `main`

Do this after the first CI run, because GitHub only lists a check once it has run at least once.

GitHub repo > **Settings** > **Branches** (or **Rules** > **Rulesets**) > add a rule for `main`:

- [ ] Require a pull request before merging
- [ ] Require status checks to pass: select **build** (the CI job)

From now on, merging a PR to `main` is the only way to deploy.

---

## Day to day

- Work on a branch and open a PR. CI checks it. Merging to `main` deploys.
- Deploys take a few minutes. CloudFront invalidation finishes a minute or two after the run turns green.
- Updating pip-walk from its standalone repo: `npm run sync:pull`, then commit and PR as usual. See the
  main [README](../README.md).
- Changing the infrastructure: edit `infra/site.yaml`, then in CloudFormation choose the stack >
  **Update** > **Replace existing template**. Review the change set before applying.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Stack stuck on `Certificate` (`CREATE_IN_PROGRESS` for 30+ min) | Nameservers at Namecheap haven't switched to Route 53, or DNSSEC is still on. Redo Step 2 and wait. |
| Stack fails: OIDC provider already exists | Your account already has one. Delete the failed stack and redeploy with `CreateGitHubOidcProvider` = `false`. |
| Stack fails: alias `example.com` already in use | Another CloudFront distribution uses that domain. Remove the alias there first. |
| Deploy fails at "Configure AWS Credentials": *Not authorized to perform sts:AssumeRoleWithWebIdentity* | The run isn't on `main` of `CmderChris/website`, or `GitHubRepo`/`GitHubBranch` don't match. The deploy only works from pushes to the configured branch. |
| Deploy fails: `AWS_ROLE_ARN` empty or "Could not load credentials" | A secret is missing or misspelled. Recheck Step 4. |
| Site returns `AccessDenied` or a blank page | Bucket is empty (deploy hasn't run yet) or the deploy failed. Check the Actions run. |
| Browser shows an old version after deploying | Hard refresh. If it persists, check the invalidation step succeeded in the Actions log. |
| Certificate or "not secure" warnings on the domain | DNS hasn't propagated yet, or you're visiting a name that isn't the apex or `www`. |

## Tearing it down

1. Empty the S3 bucket (S3 console > bucket > **Empty**). CloudFormation can't delete a non-empty bucket.
2. CloudFormation > select the `website` stack > **Delete**.
3. Optionally delete the Route 53 hosted zone (it isn't part of the stack) and switch Namecheap back to
   *Namecheap BasicDNS*.
