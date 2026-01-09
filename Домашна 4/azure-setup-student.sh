#!/bin/bash
# Make the script executable with: chmod +x azure-setup-student.sh

# Config - Change these to unique names
RESOURCE_GROUP="rg-crypto-student"
LOCATION="westeurope" # or "eastus", "northeurope"
ACR_NAME="acrcryptostudent$RANDOM" # Must be unique globally
PLAN_NAME="asp-crypto-student"
APP_NAME="app-crypto-student$RANDOM" # Must be unique globally

# 1. Login
echo "Logging in..."
az login

# 2. Create Resource Group
echo "Creating Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# 3. Create Container Registry (ACR)
echo "Creating ACR..."
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# 4. Create App Service Plan (Linux)
echo "Creating App Service Plan..."
az appservice plan create --name $PLAN_NAME --resource-group $RESOURCE_GROUP --sku B1 --is-linux

# 5. Create Web App for Containers
echo "Creating Web App..."
az webapp create --resource-group $RESOURCE_GROUP --plan $PLAN_NAME --name $APP_NAME --multicontainer-config-type compose --multicontainer-config-file docker-compose.yml

# 6. Enable Continuous Deployment (CI/CD) credentials
echo "Creating Service Principal for GitLab..."
SUBSCRIPTION_ID=$(az account show --query id --output tsv)
az ad sp create-for-rbac --name "gitlab-deploy-sp" --role Contributor --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP --sdk-auth

echo "------------------------------------------------"
echo "SETUP COMPLETE!"
echo "Use these values in your GitLab CI/CD Variables:"
echo "ACR_REGISTRY: $ACR_NAME.azurecr.io"
echo "ACR_USERNAME: (Get this from Azure Portal -> Container Registry -> Access keys)"
echo "ACR_PASSWORD: (Get this from Azure Portal -> Container Registry -> Access keys)"
echo "APP_NAME: $APP_NAME"
echo "RESOURCE_GROUP: $RESOURCE_GROUP"
echo "------------------------------------------------"
