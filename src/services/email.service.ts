import nodemailer from 'nodemailer';
import { config } from '../config';

export class EmailService {
  private transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.pass },
  });

  private async send(to: string, subject: string, html: string) {
    await this.transporter.sendMail({ from: config.email.from, to, subject, html });
  }

  async sendOrderConfirmation(
    to: string,
    order: { id: string; total: number; items: { name: string; quantity: number; price: number }[] }
  ) {
    const itemRows = order.items
      .map((i) => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>€${i.price.toFixed(2)}</td></tr>`)
      .join('');

    const html = `
      <h2>Order Confirmed ✓</h2>
      <p>Thank you for your order! Here's your summary:</p>
      <table border="1" cellpadding="8" cellspacing="0">
        <thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p><strong>Total: €${order.total.toFixed(2)}</strong></p>
      <p>Order ID: <code>${order.id}</code></p>
    `;
    await this.send(to, `Order Confirmed — #${order.id.slice(-8).toUpperCase()}`, html);
  }

  async sendAdminNewOrder(
    order: { id: string; total: number; guestEmail?: string | null; userName?: string | null }
  ) {
    const customer = order.userName || order.guestEmail || 'Guest';
    const html = `
      <h2>New Order Received</h2>
      <p><strong>Customer:</strong> ${customer}</p>
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p><strong>Total:</strong> €${order.total.toFixed(2)}</p>
      <p><a href="${config.frontendUrl}/admin/orders/${order.id}">View Order in Admin</a></p>
    `;
    await this.send(config.email.adminEmail, `New Order #${order.id.slice(-8).toUpperCase()}`, html);
  }

  async sendWelcomeWithPasswordSetup(email: string, name: string, setupToken: string) {
    const link = `${config.frontendUrl}/auth/set-password?token=${setupToken}`;
    const html = `
      <h2>Welcome to Florist, ${name}!</h2>
      <p>An account was automatically created for you after your purchase.</p>
      <p>Click the button below to set your password and access your order history:</p>
      <a href="${link}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">Set My Password</a>
      <p>This link expires in 24 hours.</p>
    `;
    await this.send(email, 'Your Florist Account — Set Your Password', html);
  }

  async sendPasswordReset(email: string, token: string, name: string) {
    const link = `${config.frontendUrl}/auth/reset-password?token=${token}`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hi ${name}, we received a request to reset your password.</p>
      <a href="${link}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">Reset Password</a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `;
    await this.send(email, 'Reset Your Florist Password', html);
  }

  async sendPaymentFailed(email: string) {
    const html = `
      <h2>Payment Failed</h2>
      <p>Unfortunately your recent payment could not be processed.</p>
      <p>Please try again or use a different payment method.</p>
      <a href="${config.frontendUrl}/cart">Return to Cart</a>
    `;
    await this.send(email, 'Payment Failed — Florist', html);
  }

  async sendOrderStatusUpdate(email: string, orderId: string, status: string) {
    const html = `
      <h2>Order Status Update</h2>
      <p>Your order <strong>#${orderId.slice(-8).toUpperCase()}</strong> is now: <strong>${status}</strong></p>
      <a href="${config.frontendUrl}/account/orders/${orderId}">View Order</a>
    `;
    await this.send(email, `Order Update — ${status}`, html);
  }
}
