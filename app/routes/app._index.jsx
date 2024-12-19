import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
} from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500" padding="500">
              <Text as="h2" variant="headingMd">
                Configure Your Cashback Program
              </Text>
              <Text as="p" variant="bodyMd">
                Set up your store's cashback rewards program to start offering rewards to your customers.
              </Text>
              <Button 
                primary
                onClick={() => navigate("store-settings")}
                fullWidth
              >
                Configure Cashback Settings
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

