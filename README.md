# Moonshot Tech - AI Chat Widget Demo

A beautiful, modern single-page web application featuring an AI-powered chat widget with real-time speech-to-text capabilities.

![Moonshot Tech](screen.png)

## 🚀 Features

### Main Website
- **Modern Dark Theme** with purple/blue gradient accents
- **Responsive Design** optimized for all devices
- **Hero Section** with compelling call-to-action
- **Services Grid** showcasing core offerings
- **Portfolio Gallery** with interactive project cards
- **Premium Typography** using Inter and Playfair Display fonts
- **Smooth Animations** and hover effects throughout

### AI Chat Widget
- 💬 **Text & Voice Input** - Type or speak your messages
- 🎤 **Real-time Speech-to-Text** powered by Deepgram
- 🤖 **AI Responses** via n8n webhook integration with RAG model
- 🎨 **Beautiful UI** matching the Moonshot brand
- 📱 **Mobile Responsive** design
- ✨ **Smooth Animations** and typing indicators

## 🛠️ Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Custom styling with gradients and animations
- **JavaScript (Vanilla)** - No frameworks required
- **Tailwind CSS** - Via CDN for utility classes
- **Deepgram API** - Real-time speech-to-text
- **n8n Webhook** - Backend AI processing

## 📁 Project Structure

```
├── index.html          # Main HTML file
├── style.css           # Custom CSS styles
├── main.js             # Main JavaScript (smooth scrolling)
├── chat-widget.js      # Chat widget with Deepgram & n8n integration
├── screen.png          # Screenshot/preview image
├── code.html           # Original source file (reference)
└── README.md           # This file
```

## 🚦 Quick Start

### Option 1: Open Locally
Simply open `index.html` in any modern web browser:
```bash
# Double-click index.html or
# Right-click → Open with → Your Browser
```

### Option 2: Use a Local Server
If you have Python installed:
```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

Or with Node.js:
```bash
npx serve
```

## 💬 Chat Widget Usage

### Text Messages
1. Click the purple chat button in the bottom-right corner
2. Type your message in the input field
3. Press Enter or click the send button
4. Wait for the AI response

### Voice Messages
1. Click the microphone button
2. Allow microphone access when prompted
3. Speak your message (you'll see "Listening..." indicator)
4. Click the microphone button again to stop
5. Your transcribed message will be sent automatically
6. Wait for the AI response

## ⚙️ Configuration

### Environment Variables

This application uses Vercel serverless functions to securely handle API keys. You need to configure the following environment variables:

**Required Environment Variables:**
- `DEEPGRAM_API_KEY` - Your Deepgram API key for speech-to-text
- `N8N_WEBHOOK_URL` - Your n8n webhook URL for AI responses

### Vercel Deployment

#### Step 1: Import to Vercel
1. Go to [Vercel](https://vercel.com/new)
2. Import your GitHub repository: `dayanaliatsabaq-eng/Chatbot-Demo`
3. Configure project settings:
   - **Framework Preset**: Other
   - **Root Directory**: `.` (leave default)
   - **Build Command**: Leave empty
   - **Output Directory**: `.`

#### Step 2: Add Environment Variables
In Vercel project settings, add these environment variables:

```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
N8N_WEBHOOK_URL=your_n8n_webhook_url_here
```

To add environment variables in Vercel:
1. Go to your project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable with its value
4. Click **Save**

#### Step 3: Deploy
Click **Deploy** and Vercel will automatically deploy your application with the serverless functions.

### Local Development

For local development, create a `.env.local` file in the root directory:

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local and add your actual values
DEEPGRAM_API_KEY=your_actual_deepgram_api_key
N8N_WEBHOOK_URL=your_actual_n8n_webhook_url
```

Then run with Vercel CLI:
```bash
npm install -g vercel
vercel dev
```

### API Endpoints

The application uses these serverless functions:

- **`/api/chat`** - Proxies messages to n8n webhook
- **`/api/transcribe`** - Handles Deepgram speech-to-text

These functions keep your API keys secure on the server side.

## 🔒 Security

✅ **API keys are now secure!**

- All sensitive credentials are stored in Vercel environment variables
- Serverless functions proxy API calls server-side
- No API keys exposed in client-side code
- CORS properly configured for API endpoints

## 🌐 Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

**Requirements:**
- Modern browser with WebSocket support
- Microphone access for voice input
- JavaScript enabled

## 📱 Mobile Support

The chat widget is fully responsive and works on:
- 📱 iOS devices
- 🤖 Android devices
- 💻 Tablets

## 🎨 Customization

### Colors
Edit `style.css` to change the color scheme:
```css
/* Brand colors */
--brand-purple: #6d28d9;
--brand-blue: #2563eb;
--brand-dark: #0a0a0c;
```

### Chat Widget Size
Adjust in `style.css`:
```css
.chat-window {
  width: 380px;
  height: 550px;
}
```

### Deepgram Settings
Modify in `chat-widget.js`:
```javascript
// Language, sample rate, encoding, etc.
const deepgramUrl = `${CONFIG.deepgramUrl}?encoding=linear16&sample_rate=16000&language=en-US`;
```

## 🐛 Troubleshooting

### Microphone Not Working
- Check browser permissions (Settings → Privacy → Microphone)
- Ensure you're using HTTPS or localhost
- Check browser console for errors

### No AI Response
- Verify n8n webhook URL is correct
- Check n8n workflow is active
- Inspect Network tab in DevTools
- Verify response format matches expected structure

### Deepgram Errors
- Verify API key is valid and active
- Check browser console for WebSocket errors
- Ensure stable internet connection

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 👨‍💻 Author

Created for Moonshot Tech - Digital Innovation Agency

---

**Need help?** Open an issue or contact support.

**Live Demo:** Open `index.html` in your browser to see it in action!
