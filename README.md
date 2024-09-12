# WhatsApp Audio Transcriber API

## Description

This project is an API designed to process WhatsApp audio messages using the **WPPConnect** library. It integrates a specialized system to send audio files for transcription and returns the results. The transcription is generated and saved in both `.srt` and `.html` formats.

## Features

- Receive audio messages via WhatsApp.
- Transcribe audio using external transcription services.
- Generate subtitle files in `.srt` and `.html` formats for easy reading.
- Supports multiple users and simultaneous requests.

## Requirements

- **Node.js** (version 14.x or higher)
- **NPM** (Node.js package manager)
- A **GitHub** account to clone the repository.
- SSH key configuration for GitHub access (optional if using HTTPS for cloning).
- **Python** for running the Flask server (optional if running local transcription service).

## Installation

### Step 1: Clone the Repository

Use the following command to clone the repository:

```bash
git clone https://github.com/felipe-pe/whatsapp-audio-transcriber-api.git
```


### Step 2: Install Node.js Dependencies
Navigate to the project directory and install the dependencies:

```bash
cd whatsapp-audio-transcriber-api
npm install
```
This command will install all dependencies listed in the package.json file, including libraries such as **WPPConnect**, **Axios**, and **SQLite3**.


### Step 3: Run the Service

Once the dependencies are installed, run the following command to start the service:

```bash
npm start
```
This will start the WhatsApp audio transcription service, ready to process incoming audio messages.

## How to Use
  ### 1. Set up your WhatsApp number with WPPConnect to connect to the service.
  ### 2. Send an audio message to the configured WhatsApp number.
  ### 3. The service will process the audio, transcribe it, and return a message with the transcription.


## Directory Structure
- `audios/` - Temporarily stores incoming audio files.
- `transcriptions/` - Contains transcription files in `.srt` and `.html`.
- `tokens/` - Used by `WPPConnect` to store active session tokens.

## Contributions
Feel free to contribute to this project by opening pull requests or reporting issues through the Issues tab.

