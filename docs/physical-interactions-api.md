# Physical Interactions API

This document describes the API endpoints for handling physical interactions like QR code scans, NFC taps, and proximity-based interactions.

## Endpoints

### 1. Create Physical Interaction

**POST** `/api/interactions/physical`

Creates a single physical interaction between two profiles.

#### Request Body

```json
{
  "profileId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "scannedProfileId": "60f7b3b3b3b3b3b3b3b3b3b4",
  "interactionType": "qr_scan", // "qr_scan", "nfc_tap", "proximity"
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "address": "New York, NY"
  },
  "metadata": {
    "deviceType": "mobile",
    "appVersion": "1.0.0",
    "customData": "any additional data"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
    "title": "QR Code Scan Interaction",
    "profile": "60f7b3b3b3b3b3b3b3b3b3b3",
    "relationship": "60f7b3b3b3b3b3b3b3b3b3b4",
    "mode": "qr_scan",
    "category": "networking",
    "isAutoGenerated": true,
    "isPhysical": true,
    "location": {
      "physicalLocation": true,
      "lat": 40.7128,
      "lng": -74.0060,
      "address": "New York, NY"
    },
    "status": "completed",
    "context": {
      "entityType": "qr_scan",
      "action": "scan",
      "metadata": {
        "scanType": "qr",
        "recorded": true,
        "deviceType": "mobile",
        "appVersion": "1.0.0"
      }
    },
    "createdAt": "2023-07-20T10:30:00.000Z",
    "lastContact": "2023-07-20T10:30:00.000Z"
  },
  "message": "Physical interaction (qr_scan) recorded successfully"
}
```

### 2. Bulk Create Physical Interactions

**POST** `/api/interactions/physical/bulk`

Creates multiple physical interactions in a single request (useful for batch processing).

#### Request Body

```json
{
  "interactions": [
    {
      "profileId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "scannedProfileId": "60f7b3b3b3b3b3b3b3b3b3b4",
      "interactionType": "qr_scan",
      "location": {
        "lat": 40.7128,
        "lng": -74.0060,
        "address": "Conference Center"
      }
    },
    {
      "profileId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "scannedProfileId": "60f7b3b3b3b3b3b3b3b3b3b5",
      "interactionType": "nfc_tap",
      "metadata": {
        "event": "networking_event"
      }
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "processed": 2,
    "failed": 0,
    "total": 2,
    "results": [
      {
        "index": 0,
        "success": true,
        "data": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b6",
          "title": "QR Code Scan Interaction",
          // ... interaction data
        }
      },
      {
        "index": 1,
        "success": true,
        "data": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b7",
          "title": "NFC Tap Interaction",
          // ... interaction data
        }
      }
    ],
    "errors": []
  },
  "message": "Processed 2 of 2 physical interactions"
}
```

## Interaction Types

### QR Code Scan (`qr_scan`)
- **Use Case**: When a user scans another user's QR code
- **Features**: 
  - Respects target profile's QR discovery settings
  - Records location if provided
  - Checks privacy permissions before allowing interaction

### NFC Tap (`nfc_tap`)
- **Use Case**: Near Field Communication interactions
- **Features**: 
  - Creates in-person interaction mode
  - Suitable for close-proximity networking

### Proximity Detection (`proximity`)
- **Use Case**: Bluetooth or other proximity-based detection
- **Features**: 
  - Automatic detection of nearby profiles
  - Useful for event networking

## Privacy & Permissions

All physical interactions respect the target profile's privacy settings:

- **QR Discovery**: Must be enabled for QR scan interactions
- **Profile Visibility**: Private profiles may reject interactions
- **Blocked Profiles**: Blocked users cannot create interactions
- **Recording Preferences**: Some interactions may not be recorded based on settings

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Profile ID and scanned profile ID are required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "QR scan interaction not allowed: QR code discovery disabled"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to create physical interaction"
}
```

## Usage Examples

### cURL Examples

#### Single QR Scan
```bash
curl -X POST http://localhost:3000/api/interactions/physical \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "profileId": "60f7b3b3b3b3b3b3b3b3b3b3",
    "scannedProfileId": "60f7b3b3b3b3b3b3b3b3b3b4",
    "interactionType": "qr_scan",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060,
      "address": "New York, NY"
    }
  }'
```

#### Bulk Interactions
```bash
curl -X POST http://localhost:3000/api/interactions/physical/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "interactions": [
      {
        "profileId": "60f7b3b3b3b3b3b3b3b3b3b3",
        "scannedProfileId": "60f7b3b3b3b3b3b3b3b3b3b4",
        "interactionType": "qr_scan"
      }
    ]
  }'
```

### JavaScript/TypeScript Example

```typescript
// Single physical interaction
const createPhysicalInteraction = async (
  profileId: string,
  scannedProfileId: string,
  interactionType: 'qr_scan' | 'nfc_tap' | 'proximity' = 'qr_scan',
  location?: { lat: number; lng: number; address?: string }
) => {
  const response = await fetch('/api/interactions/physical', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      profileId,
      scannedProfileId,
      interactionType,
      location
    })
  });

  return response.json();
};

// Bulk physical interactions
const createBulkPhysicalInteractions = async (interactions: Array<{
  profileId: string;
  scannedProfileId: string;
  interactionType?: string;
  location?: any;
  metadata?: any;
}>) => {
  const response = await fetch('/api/interactions/physical/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ interactions })
  });

  return response.json();
};
```

## Rate Limiting

- Single interactions: No specific limit
- Bulk interactions: Maximum 50 interactions per request
- Consider implementing rate limiting based on your application needs

## Best Practices

1. **Always include location data** for QR scans when available
2. **Use bulk endpoint** for processing multiple interactions efficiently
3. **Handle permission errors gracefully** in your client application
4. **Validate profile IDs** before making requests
5. **Include relevant metadata** for better interaction tracking 