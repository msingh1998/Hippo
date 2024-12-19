import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextContainer,
  Text,
  TextField,
  Button,
  BlockStack,
  Banner,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";

const FIREBASE_URL = {
  getSettings: "https://getstoresettings-pex6uon2mq-uc.a.run.app",
  updateSettings: "https://updatestoresettings-pex6uon2mq-uc.a.run.app"
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const shop = new URL(request.url).searchParams.get("shop");

  try {
    const response = await fetch(FIREBASE_URL.getSettings, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop })
    });

    if (!response.ok) throw new Error('Failed to fetch settings');
    const data = await response.json();

    return json({
      settings: data.settings,
      shop
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return json({
      settings: { cashbackPercentage: 0 },
      shop
    });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const shop = new URL(request.url).searchParams.get("shop");
  const percentage = formData.get("percentage");

  try {
    const response = await fetch(FIREBASE_URL.updateSettings, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop,
        cashbackPercentage: Number(percentage)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save settings');
    }

    return json({ success: true });
  } catch (error) {
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
};

export default function StoreSettings() {
  const { settings, shop } = useLoaderData();
  const submit = useSubmit();
  const [percentage, setPercentage] = useState(
    settings?.cashbackPercentage?.toString() || "0"
  );
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(form, { replace: true });
    setShowSuccessBanner(true);
  };

  useEffect(() => {
    if (showSuccessBanner) {
      const timer = setTimeout(() => setShowSuccessBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessBanner]);

  return (
    <Page>
      <Layout>
        <Layout.Section>
          {showSuccessBanner && (
            <Banner
              status="success"
              onDismiss={() => setShowSuccessBanner(false)}
              icon={false}
            >
              <p>Cashback settings saved successfully! Current rate: {percentage}%</p>
            </Banner>
          )}

          <Card sectioned>
            <BlockStack gap="500">
              <TextContainer>
                <Text variant="headingMd" as="h2">
                  Current Cashback Rate: {settings?.cashbackPercentage || 0}%
                </Text>
                <Text>
                  Set the cashback percentage for your customers.
                </Text>
              </TextContainer>

              <Form method="post" onSubmit={handleSubmit}>
                <BlockStack gap="400">
                  <TextField
                    label="Cashback Percentage"
                    type="text"
                    name="percentage"
                    value={percentage}
                    onChange={(value) => {
                      if (value === "" || (!isNaN(value) && value >= 0 && value <= 100)) {
                        setPercentage(value);
                      }
                    }}
                    suffix="%"
                    autoComplete="off"
                  />
                  <Button submit primary>
                    Save Settings
                  </Button>
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 