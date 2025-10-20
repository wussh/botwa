#!/bin/bash
# MongoDB initialization script
# Creates a dedicated user for the bot with proper permissions

# Switch to botwa database
use botwa

# Create bot user with read/write permissions
db.createUser({
  user: "botwa_user",
  pwd: "botwa_password_change_me",
  roles: [
    {
      role: "readWrite",
      db: "botwa"
    }
  ]
})

print("✅ BotWA database user created successfully")
