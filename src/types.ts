export type View = 'overview' | 'campaigns' | 'contacts' | 'content' | 'inquiries';

export type Contact = {
  id: string;
  parent_name: string;
  student_name: string;
  class_name: string;
  phone: string;
  email: string;
  preferred_channel: string;
  status: string;
  created_at: string;
};

export type Campaign = {
  id: string;
  title: string;
  message: string;
  channels: string[];
  recipient_count: number;
  status: string;
  category: string;
  scheduled_for?: string;
  created_at: string;
};

export type Content = {
  id: string;
  title: string;
  content_type: string;
  excerpt: string;
  image_url?: string;
  status: string;
  published_at?: string;
  created_at: string;
};

export type Inquiry = {
  id: string;
  visitor_name: string;
  email: string;
  phone?: string;
  topic?: string;
  message: string;
  status: string;
  created_at: string;
};
