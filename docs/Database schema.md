
## 1. `users`

| Column          | PostgreSQL type | Nullable | Constraints     |
| --------------- | --------------- | -------- | --------------- |
| `user_id`       | `BIGINT`        | NOT NULL | PK              |
| `email`         | `TEXT`          | NOT NULL | UNIQUE          |
| `password_hash` | `TEXT`          | NOT NULL |                 |
| `role`          | `TEXT`          | NOT NULL | CHECK           |
| `created_at`    | `TIMESTAMPTZ`   | NOT NULL | DEFAULT `NOW()` |
| name            | TEXT            | NOT NULL |                 |

**Role CHECK:**

```
CHECK (role IN ('admin', 'team_member'))
```

---

## 2. `events`

| Column       | PostgreSQL type | Nullable | Constraints          |
| ------------ | --------------- | -------- | -------------------- |
| `event_id`   | `BIGINT`        | NOT NULL | PK                   |
| `event_name` | `TEXT`          | NOT NULL |                      |
| `created_at` | `TIMESTAMPTZ`   | NOT NULL | DEFAULT `NOW()`      |
| `created_by` | `BIGINT`        | NOT NULL | FK → `users.user_id` |

### Foreign key

```
created_by REFERENCES users(user_id) ON DELETE RESTRICT
```

I added `created_by` because an event should have an identifiable owner/creator, and your checklist specifically requires proper user/event references.

---

# 3. `event_members`

This is the missing table that represents:

**User ↔ Event = Many-to-Many**

A user can belong to multiple events, and an event can have multiple team members.

|Column|PostgreSQL type|Nullable|Constraints|
|---|---|---|---|
|`event_id`|`BIGINT`|NOT NULL|FK|
|`user_id`|`BIGINT`|NOT NULL|FK|
|`joined_at`|`TIMESTAMPTZ`|NOT NULL|DEFAULT `NOW()`|

### Primary key

```
PRIMARY KEY (event_id, user_id)
```

### Foreign keys

```
event_id REFERENCES events(event_id) ON DELETE CASCADE
user_id REFERENCES users(user_id) ON DELETE RESTRICT
```

This follows your requested cascade behavior for the **join table**.

---

# 4. `galleries`

One event has one gallery according to your requirement, hence:

**`event_id UNIQUE`**

| Column         | PostgreSQL type | Nullable | Constraints             |
| -------------- | --------------- | -------- | ----------------------- |
| `gallery_id`   | `BIGINT`        | NOT NULL | PK                      |
| `event_id`     | `BIGINT`        | NOT NULL | FK, UNIQUE              |
| `created_at`   | `TIMESTAMPTZ`   | NOT NULL | DEFAULT `NOW()`         |
| `expiry_date`  | `TIMESTAMPTZ`   | NULL     |                         |
| `pin_hash`     | `TEXT`          | NOT NULL |                         |
| `public_token` | `TEXT`          | NOT NULL | UNIQUE                  |
| created by     | BIGINT          | NOT NULL | FK → `users.user_id`    |
| published_at   | `TIMESTAMPTZ`   | NULL     |                         |
| Status         | TEXT            | NOT NULL | CHECK , DEFAULT 'draft' |
| title          | TEXT            | NOT NULL |                         |
### Role check:

`CHECK ('draft', 'published')`


### Foreign key

```
event_id REFERENCES events(event_id) ON DELETE RESTRICT
```

### Important constraints

```
UNIQUE (event_id)
UNIQUE (gallery_link)
UNIQUE (public_token)
```

The `public_token` should be unique because it is presumably used to identify/access a gallery publicly.

---

# 5. `photos`

| Column         | PostgreSQL type | Nullable | Constraints     |
| -------------- | --------------- | -------- | --------------- |
| `photo_id`     | `BIGINT`        | NOT NULL | PK              |
| `event_id`     | `BIGINT`        | NOT NULL | FK              |
| `uploaded_by`  | `BIGINT`        | NOT NULL | FK              |
| `filename`     | `TEXT`          | NOT NULL |                 |
| `s3_key`       | `TEXT`          | NOT NULL |                 |
| `file_size`    | `BIGINT`        | NOT NULL | CHECK           |
| `created_at`   | `TIMESTAMPTZ`   | NOT NULL | DEFAULT `NOW()` |
| `photo_status` | `TEXT`          | NOT NULL | CHECK           |
| `content_type` | `TEXT`          | NOT NULL |                 |
| updated_at     | TIMESTAMPZ      | NOT NULL | DEFAULT NOW()   |

### Foreign keys

```
event_id REFERENCES events(event_id) ON DELETE RESTRICT

uploaded_by REFERENCES users(user_id) ON DELETE RESTRICT
```

### `file_size`

Because file sizes can be large, use `BIGINT`.

```
CHECK (file_size >= 0)
```

### `photo_status`

For example:

```
CHECK (
    photo_status IN (
        'pending',
        'uploaded',
        'failed'
    )
)
```

If these aren't the exact statuses you decided on previously, **keep your intended allowed values instead**. The important part is that the enum-like field has an explicit CHECK constraint.

---

# 6. `gallery_photos`

This is the join table connecting galleries and photos.

**Gallery ↔ Photo = Many-to-Many**

|Column|PostgreSQL type|Nullable|Constraints|
|---|---|---|---|
|`gallery_id`|`BIGINT`|NOT NULL|FK|
|`photo_id`|`BIGINT`|NOT NULL|FK|
|`added_at`|`TIMESTAMPTZ`|NOT NULL|DEFAULT `NOW()`|

### Primary key

```
PRIMARY KEY (gallery_id, photo_id)
```

### Foreign keys

```
gallery_id REFERENCES galleries(gallery_id) ON DELETE CASCADE

photo_id REFERENCES photos(photo_id) ON DELETE CASCADE
```

Because this is a **join table**, deleting either parent should remove the corresponding relationship rows.



`-- =========================================
-- TABLE DEFINITIONS
-- =========================================

CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id),

    CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'team_member'))
);


CREATE TABLE events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY,
    event_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT NOT NULL,

    PRIMARY KEY (event_id),

    CONSTRAINT events_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
        ON DELETE RESTRICT
);


CREATE TABLE event_members (
    event_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (event_id, user_id),

    CONSTRAINT event_members_event_fk
        FOREIGN KEY (event_id)
        REFERENCES events(event_id)
        ON DELETE CASCADE,

    CONSTRAINT event_members_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE RESTRICT
);


CREATE TABLE galleries (
    gallery_id BIGINT GENERATED ALWAYS AS IDENTITY,
    event_id BIGINT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    pin_hash TEXT NOT NULL,
    public_token TEXT NOT NULL UNIQUE,
    created_by BIGINT NOT NULL,
    published_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft',

    PRIMARY KEY (gallery_id),

    CONSTRAINT galleries_event_fk
        FOREIGN KEY (event_id)
        REFERENCES events(event_id)
        ON DELETE RESTRICT,

    CONSTRAINT galleries_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT galleries_status_check
        CHECK (status IN ('draft', 'published')),

    CONSTRAINT galleries_published_consistency_check
        CHECK (
            (status = 'published' AND published_at IS NOT NULL)
            OR
            (status = 'draft')
        )
);


CREATE TABLE photos (
    photo_id BIGINT GENERATED ALWAYS AS IDENTITY,
    event_id BIGINT NOT NULL,
    uploaded_by BIGINT NOT NULL,
    filename TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    photo_status TEXT NOT NULL,
    content_type TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (photo_id),

    CONSTRAINT photos_event_fk
        FOREIGN KEY (event_id)
        REFERENCES events(event_id)
        ON DELETE RESTRICT,

    CONSTRAINT photos_uploaded_by_fk
        FOREIGN KEY (uploaded_by)
        REFERENCES users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT photos_file_size_check
        CHECK (file_size >= 0),

    CONSTRAINT photos_status_check
        CHECK (
            photo_status IN (
                'pending',
                'uploaded',
                'failed'
            )
        )
);


CREATE TABLE gallery_photos (
    gallery_id BIGINT NOT NULL,
    photo_id BIGINT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (gallery_id, photo_id),

    CONSTRAINT gallery_photos_gallery_fk
        FOREIGN KEY (gallery_id)
        REFERENCES galleries(gallery_id)
        ON DELETE CASCADE,

    CONSTRAINT gallery_photos_photo_fk
        FOREIGN KEY (photo_id)
        REFERENCES photos(photo_id)
        ON DELETE CASCADE
);


-- =========================================
-- INDEXES
-- =========================================

CREATE INDEX idx_events_created_by
ON events (created_by);


CREATE INDEX idx_event_members_user_id
ON event_members (user_id);


CREATE INDEX idx_galleries_created_by
ON galleries (created_by);


CREATE INDEX idx_photos_event_id
ON photos (event_id);


CREATE INDEX idx_photos_uploaded_by
ON photos (uploaded_by);


CREATE INDEX idx_gallery_photos_photo_id
ON gallery_photos (photo_id);`

