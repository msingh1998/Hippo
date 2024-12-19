import { json } from "@remix-run/node";
import { Link, Outlet, useRouteError, useLoaderData } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { authenticate } from "../shopify.server";
import { Page, Banner, Layout } from "@shopify/polaris";

export const headers = () => ({
  "Cache-Control": "no-store"
});

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <AppProvider>
      <Page>
        <Layout>
          <Layout.Section>
            <Banner status="critical">
              <p>Something went wrong:</p>
              <pre>{error.message}</pre>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}

export const loader = async ({ request }) => {
  console.log("App Layout Loader Called");
  const { admin, session } = await authenticate.admin(request);
  console.log("Authentication result:", { session: !!session });
  
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    host: new URL(request.url).searchParams.get("host"),
  });
};

export default function App() {
  const { apiKey, host } = useLoaderData();
  
  return (
    <AppProvider isEmbeddedApp apiKey={apiKey} host={host}>
      <ui-nav-menu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/store-settings">
          Cashback Settings
        </Link>
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}
