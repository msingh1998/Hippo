import { json } from "@remix-run/node";

export async function action({ request }) {
  const shop = request.headers.get("x-shopify-shop-domain");
  const body = await request.json();

  try {
    // First process the existing receipt logic
    const receiptResponse = await fetch('https://us-central1-payment-m.cloudfunctions.net/handleOrderPaid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': shop
      },
      body: JSON.stringify({
        shop,
        orderId: body.id,
        checkoutToken: body.checkout_token,
        cartToken: body.cart_token,
        status: 'completed',
        orderDetails: {
          number: body.number,
          totalPrice: body.total_price,
          currency: body.currency,
          createdAt: body.created_at,
          customer: {
            email: body.email,
            firstName: body.customer?.first_name,
            lastName: body.customer?.last_name,
            phone: body.customer?.phone
          },
          shippingAddress: body.shipping_address ? {
            address1: body.shipping_address.address1,
            city: body.shipping_address.city,
            country: body.shipping_address.country,
            zip: body.shipping_address.zip
          } : null,
          items: body.line_items.map(item => ({
            productId: item.product_id,
            variantId: item.variant_id,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku
          })),
          payment: {
            gateway: body.gateway,
            processorName: body.processing_method,
            ...(body.payment_details?.credit_card_number && {
              last4: body.payment_details.credit_card_number.slice(-4)
            })
          }
        }
      })
    });

    // Then process cashback
    const cashbackResponse = await fetch('https://us-central1-payment-m.cloudfunctions.net/processCashback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': shop
      },
      body: JSON.stringify({
        shop,
        orderData: body
      })
    });

    return json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}