import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  LegacyCard,
  FormLayout,
  TextField,
  Button,
  Text,
  Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // Get current store settings
  const response = await admin.graphql(`
    query getShop {
      shop {
        id
        name
      }
    }
  `);
  const { shop } = await response.json();
  
  return { shop };
}

export default function Settings() {
  const [cashbackRate, setCashbackRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    // Fetch current settings when component mounts
    fetchCurrentSettings();
  }, []);

  async function fetchCurrentSettings() {
    try {
      const response = await fetch('/api/settings/get');
      const data = await response.json();
      if (data.settings?.cashbackPercentage) {
        setCashbackRate(data.settings.cashbackPercentage.toString());
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setStatus({
        type: "error",
        message: "Failed to load current settings"
      });
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cashbackPercentage: parseFloat(cashbackRate)
        })
      });

      const data = await response.json();
      
      setStatus({
        type: "success",
        message: "Cashback rate updated successfully"
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: "Failed to update cashback rate"
      });
    }
    setLoading(false);
  }

  return (
    <Page title="Store Settings">
      <Layout>
        <Layout.Section>
          {status.type && (
            <Banner
              status={status.type}
              onDismiss={() => setStatus({ type: "", message: "" })}
            >
              {status.message}
            </Banner>
          )}
          <LegacyCard sectioned>
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Cashback Settings
              </Text>
              <TextField
                label="Cashback Rate (%)"
                type="number"
                value={cashbackRate}
                onChange={setCashbackRate}
                helpText="Enter the percentage of purchase amount to give as cashback"
                min={0}
                max={100}
                autoComplete="off"
              />
              <Button
                primary
                loading={loading}
                onClick={handleSubmit}
              >
                Save Settings
              </Button>
            </FormLayout>
          </LegacyCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 