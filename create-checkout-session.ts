{
  "entities": {
    "User": {
      "title": "User Profile",
      "description": "Stores user profile information and settings.",
      "type": "object",
      "properties": {
        "uid": { "type": "string", "description": "Unique identifier for the user." },
        "displayName": { "type": "string", "description": "The user's display name." },
        "email": { "type": "string", "format": "email", "description": "The user's email address." },
        "createdAt": { "type": "string", "format": "date-time", "description": "When the user profile was created." }
      },
      "required": ["uid", "email"]
    },
    "ChatSession": {
      "title": "Chat Session",
      "description": "Represents a conversation between a parent and the AI assistant.",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "userId": { "type": "string" },
        "title": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["userId", "title", "createdAt"]
    },
    "ChatMessage": {
      "title": "Chat Message",
      "description": "A single message within a chat session.",
      "type": "object",
      "properties": {
        "role": { "type": "string", "enum": ["user", "model"] },
        "content": { "type": "string" },
        "timestamp": { "type": "string", "format": "date-time" },
        "attachments": { "type": "array", "items": { "type": "string" }, "description": "URLs to uploaded images or files." }
      },
      "required": ["role", "content", "timestamp"]
    },
    "HomeworkPlan": {
      "title": "Homework Plan",
      "description": "A weekly plan for homework and studies.",
      "type": "object",
      "properties": {
        "userId": { "type": "string" },
        "weekNumber": { "type": "integer" },
        "year": { "type": "integer" },
        "tasks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "day": { "type": "string" },
              "subject": { "type": "string" },
              "description": { "type": "string" },
              "completed": { "type": "boolean" }
            }
          }
        }
      },
      "required": ["userId", "weekNumber", "year"]
    },
    "Task": {
      "title": "Task",
      "description": "A single homework task.",
      "type": "object",
      "properties": {
        "day": { "type": "string" },
        "subject": { "type": "string" },
        "description": { "type": "string" },
        "completed": { "type": "boolean" },
        "weekNumber": { "type": "integer" },
        "year": { "type": "integer" },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["day", "subject", "weekNumber", "year"]
    },
    "Child": {
      "title": "Child",
      "description": "A child profile associated with a user.",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "grade": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "sharedWith": { "type": "array", "items": { "type": "string" }, "description": "List of emails of other parents who have access." }
      },
      "required": ["name"]
    },
    "LibraryItem": {
      "title": "Library Item",
      "description": "A saved resource, explanation, or image in the resource library.",
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "content": { "type": "string" },
        "type": { "type": "string", "enum": ["text", "image"] },
        "imageUrl": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "subject": { "type": "string" }
      },
      "required": ["title", "type", "createdAt"]
    }
  },
  "firestore": {
    "/users/{userId}": {
      "schema": "User",
      "description": "User profile documents."
    },
    "/users/{userId}/children/{childId}": {
      "schema": "Child",
      "description": "Children associated with a user."
    },
    "/users/{userId}/children/{childId}/chatSessions/{sessionId}": {
      "schema": "ChatSession",
      "description": "Chat sessions for a specific child."
    },
    "/users/{userId}/children/{childId}/chatSessions/{sessionId}/messages/{messageId}": {
      "schema": "ChatMessage",
      "description": "Messages within a chat session."
    },
    "/users/{userId}/children/{childId}/homeworkPlans/{planId}": {
      "schema": "HomeworkPlan",
      "description": "Homework plans for a specific child."
    },
    "/users/{userId}/children/{childId}/tasks/{taskId}": {
      "schema": "Task",
      "description": "Individual tasks for a specific child."
    },
    "/users/{userId}/children/{childId}/library/{itemId}": {
      "schema": "LibraryItem",
      "description": "Saved resources in the child's library."
    }
  }
}
