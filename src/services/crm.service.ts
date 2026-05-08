import axios from 'axios';
import { config } from '../config';
import { CrmContact } from '../types';

export class CrmService {
  async syncContact(contact: CrmContact): Promise<void> {
    switch (config.crm.provider) {
      case 'hubspot':
        return this.syncHubspot(contact);
      case 'pipedrive':
        return this.syncPipedrive(contact);
      case 'salesforce':
        return this.syncSalesforce(contact);
      default:
        console.log('[crm] Provider is "none" — skipping CRM sync');
    }
  }

  private async syncHubspot(contact: CrmContact) {
    const baseUrl = config.crm.baseUrl || 'https://api.hubapi.com';
    const headers = { Authorization: `Bearer ${config.crm.apiKey}`, 'Content-Type': 'application/json' };

    // Upsert contact
    await axios.post(
      `${baseUrl}/crm/v3/objects/contacts`,
      {
        properties: {
          email: contact.email,
          firstname: contact.name.split(' ')[0],
          lastname: contact.name.split(' ').slice(1).join(' '),
          phone: contact.phone || '',
        },
      },
      { headers }
    );

    // Create deal
    await axios.post(
      `${baseUrl}/crm/v3/objects/deals`,
      {
        properties: {
          dealname: `Order ${contact.orderId.slice(-8).toUpperCase()}`,
          amount: contact.orderTotal,
          closedate: contact.orderDate,
          dealstage: 'closedwon',
        },
      },
      { headers }
    );
  }

  private async syncPipedrive(contact: CrmContact) {
    const baseUrl = config.crm.baseUrl || 'https://api.pipedrive.com/v1';
    const params = { api_token: config.crm.apiKey };

    await axios.post(`${baseUrl}/persons`, { name: contact.name, email: contact.email }, { params });
    await axios.post(
      `${baseUrl}/deals`,
      { title: `Order ${contact.orderId.slice(-8).toUpperCase()}`, value: contact.orderTotal },
      { params }
    );
  }

  private async syncSalesforce(_contact: CrmContact) {
    // Salesforce requires OAuth2 — placeholder for implementation
    console.log('[crm] Salesforce sync — configure OAuth2 flow');
  }
}
