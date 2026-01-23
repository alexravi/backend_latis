# Azure Blob Storage Setup Guide

## Current Error: 403 Forbidden

The error "This request is not authorized to perform this operation" indicates that your Azure Storage account credentials are valid, but the account doesn't have the necessary permissions to create containers or generate SAS tokens.

## Required Infrastructure Changes

### 1. Check Storage Account Access Keys

**In Azure Portal:**
1. Go to your Storage Account: `medialatis`
2. Navigate to **Security + networking** → **Access keys**
3. Verify that **Key1** or **Key2** matches your connection string
4. If keys don't match, update your `.env` file with the correct key

### 2. Verify Storage Account Permissions

**Required Permissions:**
- **Blob Data Contributor** role (minimum)
- Or **Storage Blob Data Contributor** role
- Or **Storage Account Contributor** role (full access)

**To assign permissions:**
1. Go to Storage Account → **Access control (IAM)**
2. Click **+ Add** → **Add role assignment**
3. Select **Storage Blob Data Contributor**
4. Assign to your application/service principal

### 3. Check Storage Account Configuration

**In Azure Portal → Storage Account → Configuration:**

**Required Settings:**
- ✅ **Allow Blob public access**: Can be disabled (we use SAS tokens)
- ✅ **Secure transfer required**: Can be enabled
- ✅ **Minimum TLS version**: 1.2 or higher
- ✅ **Blob soft delete**: Recommended (enabled)
- ✅ **Versioning**: Optional but recommended

### 4. Verify Connection String Format

Your connection string should be:
```
DefaultEndpointsProtocol=https;AccountName=medialatis;AccountKey=<FULL_KEY_INCLUDING_==>;EndpointSuffix=core.windows.net
```

**Important:** The AccountKey must include the `==` at the end if present.

### 5. Check Network Access Rules

**In Azure Portal → Storage Account → Networking:**

**Options:**
- **Allow access from all networks** (for development)
- **Allow access from selected virtual networks and IP addresses** (for production)
- **Public network access**: Should be **Enabled** for blob access

### 6. Verify Storage Account Exists and is Active

**Check:**
1. Storage account name: `medialatis`
2. Status: Should be **Active**
3. Region: Should match your deployment region
4. Performance: **Standard** or **Premium**
5. Account kind: **StorageV2** (General-purpose v2)

### 7. Test with Azure CLI (Optional)

```bash
# Install Azure CLI if not installed
# az login

# Test connection
az storage account show \
  --name medialatis \
  --resource-group <your-resource-group> \
  --query "{name:name, status:provisioningState, kind:kind}"

# List containers
az storage container list \
  --account-name medialatis \
  --account-key <your-key> \
  --auth-mode key
```

## Common Issues and Solutions

### Issue 1: AccountKey is Expired or Rotated
**Solution:** Regenerate access keys in Azure Portal and update `.env`

### Issue 2: Storage Account Uses Azure AD Authentication
**Solution:** Either:
- Switch to access key authentication, OR
- Use Azure AD authentication (requires code changes)

### Issue 3: Network Rules Blocking Access
**Solution:** 
- Add your server's IP to allowed IPs, OR
- Enable "Allow access from all networks" for testing

### Issue 4: Storage Account is in Different Subscription
**Solution:** Verify you're using the correct subscription and resource group

### Issue 5: Storage Account Kind Doesn't Support Blobs
**Solution:** Ensure account kind is **StorageV2** (General-purpose v2)

## Quick Fix Checklist

- [ ] Verify AccountKey in Azure Portal matches `.env` file
- [ ] Check if AccountKey was rotated (regenerate if needed)
- [ ] Verify Storage Account is **Active** and **StorageV2**
- [ ] Check **Networking** settings allow your IP/network
- [ ] Verify **Access Control (IAM)** has proper role assignments
- [ ] Test connection string format is correct
- [ ] Ensure AccountKey includes `==` at the end if present

## Alternative: Use SAS Token Authentication

Instead of using a connection string, you can use a SAS (Shared Access Signature) token for server operations.

### Generate SAS Token in Azure Portal

1. Go to Azure Portal → Storage Account → **Shared access signature**
2. Configure permissions:
   - ✅ **Blob** service
   - ✅ **Read**, **Write**, **Create**, **List** permissions (for container operations)
   - ✅ **Add**, **Create** permissions (for blob operations)
3. Set **Start time** and **Expiry time** (e.g., 1 year for long-lived token)
4. Click **Generate SAS and connection string**
5. Copy the **SAS token** (the query string part, e.g., `?sv=2021-06-08&ss=b&srt=co&sp=rwdlacup&se=...`)

### Configure Environment Variables

Add to your `.env` file:

```bash
# Option 1: Use SAS token URL (full URL with SAS token)
AZURE_STORAGE_SAS_TOKEN_URL=https://medialatis.blob.core.windows.net/?sv=2021-06-08&ss=b&srt=co&sp=rwdlacup&se=2027-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https&sig=...
AZURE_STORAGE_ACCOUNT_NAME=medialatis

# Option 2: Still need account key for generating new SAS tokens for client uploads
# (The server uses SAS token, but needs account key to generate client upload tokens)
AZURE_STORAGE_ACCOUNT_KEY=<your-account-key>
```

### Generate SAS Token via Azure CLI

```bash
# Generate account-level SAS token (valid for 1 year)
az storage account generate-sas \
  --account-name medialatis \
  --account-key <your-key> \
  --services b \
  --resource-types sco \
  --permissions rwdlacup \
  --expiry 2027-12-31T23:59:59Z \
  --output tsv

# Construct full URL
# https://medialatis.blob.core.windows.net/?<sas-token>
```

### Generate Container-Level SAS Token

For more restricted access (only specific containers):

```bash
# Generate container-level SAS token
az storage container generate-sas \
  --account-name medialatis \
  --account-key <your-key> \
  --name private-originals \
  --permissions rwdlac \
  --expiry 2027-12-31T23:59:59Z \
  --output tsv
```

### Important Notes

- **SAS tokens expire**: Set a long expiry (1 year) for server operations
- **Account key still needed**: To generate new SAS tokens for client uploads, you still need `AZURE_STORAGE_ACCOUNT_KEY` or `AZURE_STORAGE_CONNECTION_STRING`
- **Permissions**: Ensure SAS token has `rwdlacup` (read, write, delete, list, add, create, update, process) for full functionality
- **Security**: Store SAS tokens securely, never commit to git

### Priority Order

The system checks authentication in this order:
1. `AZURE_STORAGE_CONNECTION_STRING` (if provided, uses this)
2. `AZURE_STORAGE_SAS_TOKEN_URL` + `AZURE_STORAGE_ACCOUNT_NAME` (if connection string not provided)

## Alternative: Use Azure AD Authentication

If access keys are not available, you can use Azure AD authentication:

1. Create a Service Principal or Managed Identity
2. Assign **Storage Blob Data Contributor** role
3. Update code to use `DefaultAzureCredential` instead of connection string

## Testing After Fixes

After making infrastructure changes, test with:

```bash
node -e "require('dotenv').config(); const { BlobServiceClient } = require('@azure/storage-blob'); const client = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING); (async () => { try { for await (const container of client.listContainers()) { console.log('Container:', container.name); } } catch(e) { console.error('Error:', e.message); } })();"
```

## Support

If issues persist:
1. Check Azure Storage account logs in Azure Portal
2. Verify the storage account exists and is accessible
3. Check Azure Service Health for any outages
4. Review Azure Storage account metrics for throttling
