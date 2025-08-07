export interface SmsMessage {
  body: string;
  to: string;
  from?: string;
  source?: string;
  schedule?: number;
  custom_string?: string;
  list_id?: string;
  contact_id?: number;
  country?: string;
  from_email?: string;
  exclude_no_sender_id_recipients?: boolean;
}