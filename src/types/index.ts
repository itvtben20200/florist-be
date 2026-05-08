export interface JwtPayload {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPERADMIN';
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}

export interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  state?: string;
  country: string;
  zip: string;
  phone?: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CheckoutPayload {
  items: CartItem[];
  shippingAddress?: ShippingAddress;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  guestCompany?: string;
}

export interface CrmContact {
  email: string;
  name: string;
  phone?: string;
  orderId: string;
  orderTotal: number;
  orderDate: string;
  items: { name: string; quantity: number; price: number }[];
}
