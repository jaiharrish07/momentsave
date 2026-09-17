export type UserRole = "admin" | "team_member";

export type User = {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
};

export type Event = {
  event_id: string;
  event_name: string;
  created_by: string;
  created_at: string;
};

export type EventMember = {
  user_id: string;
  name: string;
  email: string;
  role: "team_member";
  joined_at: string;
};

export type PhotoStatus = "pending" | "uploaded" | "failed";

export type Photo = {
  photo_id: string;
  event_id: string;
  uploaded_by: string;
  filename: string;
  file_size: string;
  content_type: string;
  photo_status: PhotoStatus;
  created_at: string;
  updated_at: string;
};

export type PhotoInGallery = {
  photo_id: string;
  filename: string;
  content_type: string;
  file_size: string;
  added_at: string;
};

export type GalleryStatus = "draft" | "published";

export type Gallery = {
  gallery_id: string;
  event_id: string;
  title: string;
  public_token: string;
  status: GalleryStatus;
  created_by: string;
  created_at: string;
  published_at: string | null;
  expiry_date: string | null;
  photo_count: number;
};

export type Paginated<TKey extends string, TItem> = {
  page: number;
  limit: number;
  total: number;
} & { [K in TKey]: TItem[] };
