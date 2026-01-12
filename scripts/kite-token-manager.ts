/**
 * Zerodha Kite Token Manager for Supabase
 *
 * This script handles the Kite Connect authentication and stores the access token in Supabase.
 * Run this script daily (preferably before market opening) to refresh the Kite access token.
 * The token is valid until 6 AM the next day.
 */

import { KiteConnect } from "kiteconnect";
import { createClient } from "@supabase/supabase-js";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Zerodha credentials
const API_KEY = process.env.KITE_API_KEY;
const API_SECRET = process.env.KITE_API_SECRET;

// Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface KiteTokenData {
  access_token: string;
  created_at: string;
  expires_at: string;
}

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Open URL in default browser
 */
async function openBrowser(url: string) {
  const platform = process.platform;
  let command: string;

  if (platform === "win32") {
    command = `start ${url}`;
  } else if (platform === "darwin") {
    command = `open ${url}`;
  } else {
    command = `xdg-open ${url}`;
  }

  try {
    await execAsync(command);
    console.log(`✓ Browser opened: ${url}`);
  } catch (error) {
    console.log(
      `⚠ Could not open browser automatically. Please open manually: ${url}`
    );
  }
}

/**
 * Authenticate with Zerodha Kite and get access token
 */
async function authenticateKite(): Promise<string> {
  console.log("\n" + "=".repeat(70));
  console.log("ZERODHA KITE TOKEN REFRESH");
  console.log("=".repeat(70));

  if (!API_KEY || !API_SECRET) {
    throw new Error(
      "KITE_API_KEY and KITE_API_SECRET must be set in .env file"
    );
  }

  const kite = new KiteConnect({
    api_key: API_KEY,
  });

  // Generate login URL
  const loginUrl = kite.getLoginURL();

  console.log("\nSteps:");
  console.log("1. Browser will open with Zerodha login page");
  console.log("2. Login with your Zerodha credentials");
  console.log("3. After successful login, you'll be redirected to a URL");
  console.log("4. Copy the ENTIRE redirect URL from the browser");
  console.log("5. Paste it here");
  console.log("=".repeat(70) + "\n");

  // Open browser
  await openBrowser(loginUrl);

  // Get redirect URL from user
  const rl = createReadlineInterface();
  const redirectUrl = await question(
    rl,
    "\nAfter logging in, paste the redirect URL here:\nRedirect URL: "
  );
  rl.close();

  // Extract request token from URL
  const url = new URL(redirectUrl);
  const requestToken = url.searchParams.get("request_token");

  if (!requestToken) {
    throw new Error("Invalid redirect URL. Request token not found.");
  }

  console.log(
    `\n✓ Request token obtained: ${requestToken.substring(0, 20)}...`
  );

  // Generate session
  const session = await kite.generateSession(requestToken, API_SECRET!);
  const accessToken = session.access_token;

  console.log(`✓ Access token obtained: ${accessToken.substring(0, 20)}...`);

  return accessToken;
}

/**
 * Save access token to Supabase
 * Kite tokens expire at 6 AM next day
 */
async function saveTokenToSupabase(accessToken: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase credentials not found in .env file");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Calculate expiry (6 AM next day)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);

  // Save to database
  const data: KiteTokenData = {
    access_token: accessToken,
    created_at: now.toISOString(),
    expires_at: tomorrow.toISOString(),
  };

  try {
    const { error } = await supabase.from("kite_tokens").insert(data);

    if (error) {
      throw error;
    }

    console.log("✓ Token saved to Supabase");
    console.log(`✓ Valid until: ${tomorrow.toLocaleString()}`);
    return true;
  } catch (error) {
    console.error("✗ Error saving to Supabase:", error);
    return false;
  }
}

/**
 * Update the local .env file with new access token
 */
async function updateLocalEnv(accessToken: string): Promise<boolean> {
  try {
    const envPath = path.resolve(process.cwd(), ".env");

    // Read current .env content
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    const lines = envContent.split("\n");
    let updated = false;

    // Update KITE_ACCESS_TOKEN line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("KITE_ACCESS_TOKEN=")) {
        lines[i] = `KITE_ACCESS_TOKEN=${accessToken}`;
        updated = true;
        break;
      }
    }

    // If KITE_ACCESS_TOKEN line doesn't exist, add it
    if (!updated) {
      lines.push(`KITE_ACCESS_TOKEN=${accessToken}`);
    }

    // Write back to file
    fs.writeFileSync(envPath, lines.join("\n"));

    console.log("✓ Local .env file updated");
    return true;
  } catch (error) {
    console.error("✗ Error updating .env file:", error);
    return false;
  }
}

/**
 * Main function to refresh Kite token
 */
async function main() {
  try {
    console.log("Starting Kite token refresh process...");

    // Step 1: Authenticate and get token
    const accessToken = await authenticateKite();

    // Step 2: Save to Supabase
    await saveTokenToSupabase(accessToken);

    // Step 3: Update local .env file
    await updateLocalEnv(accessToken);

    console.log("\n" + "=".repeat(70));
    console.log("✓ TOKEN REFRESH COMPLETED SUCCESSFULLY");
    console.log("=".repeat(70));
    console.log("\nNext steps:");
    console.log("1. The Edge Function can now fetch data using this token");
    console.log("2. This token is valid until 6 AM tomorrow");
    console.log("3. Run this script again tomorrow to refresh the token");
    console.log("\nTo automate this process, you can:");
    console.log("- Set up a cron job to run this script daily");
    console.log("- Or manually run it before market hours each day");
    console.log("=".repeat(70) + "\n");

    return true;
  } catch (error) {
    console.error("\n✗ Error:", error);
    return false;
  }
}

// Run the script
if (require.main === module) {
  main()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export { authenticateKite, saveTokenToSupabase, updateLocalEnv };
