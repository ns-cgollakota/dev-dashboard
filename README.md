Create a `.env` file and add below information as pre your requirement

# Jira Cloud
JIRA_BASE_URL=https://netskope.atlassian.net <br/>
JIRA_EMAIL=<your_emeail><br/>
JIRA_API_TOKEN=<api_token><br/>

# Confluence Cloud (usually same instance/token as Jira)
CONFLUENCE_BASE_URL=https://netskope.atlassian.net<br/>
CONFLUENCE_EMAIL=<your_email><br/>
CONFLUENCE_API_TOKEN=<api_token><br/>
# Your Atlassian account ID (find it at: yourcompany.atlassian.net/rest/api/3/myself)
CONFLUENCE_ACCOUNT_ID=<account_id>

# GitHub
GITHUB_TOKEN=<github_token><br/>
GITHUB_USERNAME=<github_username><br/>

# These are used by the React app to build deep links.
VITE_JIRA_BASE_URL=https://netskope.atlassian.net<br/>
VITE_CONFLUENCE_BASE_URL=https://netskope.atlassian.net<br/>
VITE_CONFLUENCE_ACCOUNT_ID=<account_id><br/>
VITE_GITHUB_USERNAME=<github_username><br/>
VITE_GITHUB_ORG=netSkope<br/>
VITE_DISPLAY_NAME=<your_name><br/>
VITE_DESIGNATION=<your_designation><br/>

# Slack — On-Call monitor
# Bot needs: channels:history + channels:read scopes
# Channel ID: right-click #dp-oncall in Slack → View channel details → copy ID
SLACK_BOT_TOKEN=<token><br/>
SLACK_CHANNEL_ID=<channel_id><br/>
VITE_SLACK_CHANNEL_ID=<chan_id><br/>


# How to start
npm run dev

sshukla@HG9B874:~/dev-dashboard$ dashboard

> dev-dashboard@0.0.0 dev
> vite


  VITE v8.0.5  ready in 704 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help

In your browser open: http://localhost:5173/
