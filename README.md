**Join the [Lunar Studios](https://discord.gg/lunarstudio) for support, updates, and community help!**

## Features

- About:Blank Cloaking
- Tab Cloaking
- Wide collection of apps & games
- Clean, Easy to use UI
- Various Themes
- Password Protection (Optional)
- Built-in Tab System
- Fast Speeds

## Report Issues

If you encounter problems, open an issue on GitHub, and we'll address it promptly.

> [!TIP]
> If you're having trouble, please contact us and create a ticket at [Discord](https://discord.gg/lunarstudio) for support.

## Lunar AI setup

The homepage includes an account-backed AI chat panel. To enable responses, create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and add it to your hosting provider as the server environment variable `GEMINI_API_KEY`. Do not put the key in browser JavaScript or commit it to GitHub. You can optionally set `GEMINI_MODEL` to a supported Gemini model; the default is `gemini-3.6-flash`.

The API key stays on the server. Chats are stored per Lunar account in the community data file. The free API tier has provider-controlled usage limits, and uploaded images are analyzed for the request but are not stored in chat history; attachment names are saved with the conversation.
