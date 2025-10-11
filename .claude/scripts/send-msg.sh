#!/bin/bash

set -o errexit
set -o errtrace

trap 'echo "Error: ${BASH_COMMAND}" >&2; exit 1' ERR

if ! command -v kdeconnect-cli >/dev/null 2>&1; then
	echo "kdeconnect-cli not installed; skipping." >&2
	exit 0
fi

# Check if input was provided
if [ $# -eq 0 ]; then
    echo "Error: Please provide input as an argument"
    echo "Usage: $0 '{\"hook_event_name\":\"...\",\"message\":\"...\"}'"
    exit 1
fi

INPUT="$1"
MESSAGE=""

# Try to parse as JSON
if echo "$INPUT" | jq -e . >/dev/null 2>&1; then
    # Input is valid JSON - extract fields
    HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
    MSG_CONTENT=$(echo "$INPUT" | jq -r '.message // empty')


    MESSAGE="$HOOK_EVENT $MSG_CONTENT"

else
    # Not JSON - treat as plain text message
    MESSAGE="$INPUT"
fi

# Get the first available device ID
DEVICE_ID=$(kdeconnect-cli -a --id-only)

# Check if we found a device
if [ -z "$DEVICE_ID" ]; then
    echo "Error: No KDE Connect devices found"
    exit 1
fi

# Send the ping message
echo "Sending message to device..."
kdeconnect-cli --device "$DEVICE_ID" --ping-msg "$MESSAGE"

# Check if the command succeeded
if [ $? -eq 0 ]; then
    echo "Message sent successfully!"
else
    echo "Failed to send message"
    exit 1
fi