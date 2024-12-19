import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    // Fetch current settings from Firebase
    const response = await fetch(`${process.env.FIREBASE_FUNCTIONS_URL}/getStoreSettings?shop=${session.shop}`);
    const data = await response.json();
    
    return new Response(JSON.stringify(data));
  } catch (error) {
    console.error('Error fetching settings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch settings' }),
      { status: 500 }
    );
  }
} 