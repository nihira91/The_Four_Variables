console.log("🤖 Hugging Face NLP Service loading...");

const { pipeline } = require("@xenova/transformers");

// Cache pipelines to avoid reloading
let zeroShotClassifier = null;
let sentimentAnalyzer = null;

// Category labels for zero-shot classification
const CATEGORY_LABELS = [
  "Electrical issue with power and lighting",
  "Plumbing issue with water and pipes",
  "Network and internet connectivity issue",
  "HVAC air conditioning and heating issue",
  "General maintenance and repair",
  "Security and access control issue"
];

const CATEGORY_MAP = {
  "Electrical issue with power and lighting": "Electrical",
  "Plumbing issue with water and pipes": "Plumbing",
  "Network and internet connectivity issue": "Network",
  "HVAC air conditioning and heating issue": "HVAC",
  "General maintenance and repair": "Maintenance",
  "Security and access control issue": "Security"
};

/**
 * Initialize classifiers (lazy load on first use)
 */
async function initializeClassifiers() {
  try {
    if (!zeroShotClassifier) {
      console.log("📥 Loading Zero-Shot Classification model...");
      zeroShotClassifier = await pipeline(
        "zero-shot-classification",
        "Xenova/nli-minilm-l6-v2"
      );
      console.log("✅ Zero-Shot Classifier loaded");
    }

    if (!sentimentAnalyzer) {
      console.log("📥 Loading Sentiment Analysis model...");
      sentimentAnalyzer = await pipeline(
        "sentiment-analysis",
        "Xenova/distilbert-base-uncased-finetuned-sst-2-english"
      );
      console.log("✅ Sentiment Analyzer loaded");
    }
  } catch (error) {
    console.error("❌ Error loading classifiers:", error.message);
    throw error;
  }
}

/**
 * Categorize issue using zero-shot classification
 */
async function categorizeWithZeroShot(text) {
  try {
    await initializeClassifiers();

    console.log("🔍 Analyzing issue category...");
    const result = await zeroShotClassifier(text, CATEGORY_LABELS);

    // Get top result
    const topLabel = result.labels[0];
    const confidence = Math.round(result.scores[0] * 100);

    const category = CATEGORY_MAP[topLabel] || "Other";

    console.log(`✅ Category: ${category} (${confidence}% confidence)`);

    return {
      category,
      confidence,
      topLabel
    };
  } catch (error) {
    console.error("❌ Zero-shot classification error:", error);
    throw error;
  }
}

/**
 * Determine priority using sentiment and intensity analysis
 */
async function determinePriorityWithSentiment(text) {
  try {
    await initializeClassifiers();

    console.log("📊 Analyzing sentiment and urgency...");

    // Analyze sentiment
    const sentimentResult = await sentimentAnalyzer(text);
    const sentiment = sentimentResult[0];
    console.log(`📈 Sentiment: ${sentiment.label} (${Math.round(sentiment.score * 100)}%)`);

    // Analyze urgency keywords
    const urgencyScore = calculateUrgencyScore(text);

    // Determine priority based on sentiment + urgency
    let priority = "Routine";
    let priorityScore = 0;

    if (sentiment.label === "NEGATIVE" && sentiment.score > 0.9 && urgencyScore > 70) {
      priority = "Critical";
      priorityScore = 90;
    } else if (sentiment.label === "NEGATIVE" && sentiment.score > 0.8 && urgencyScore > 50) {
      priority = "Urgent";
      priorityScore = 75;
    } else if (sentiment.label === "NEGATIVE" && sentiment.score > 0.6) {
      priority = "Risky";
      priorityScore = 50;
    } else {
      priority = "Routine";
      priorityScore = 25;
    }

    console.log(`⚡ Priority: ${priority} (Score: ${priorityScore})`);

    return {
      priority,
      priorityScore,
      sentiment: sentiment.label,
      sentimentScore: Math.round(sentiment.score * 100)
    };
  } catch (error) {
    console.error("❌ Sentiment analysis error:", error);
    throw error;
  }
}

/**
 * Calculate urgency score based on keywords
 */
function calculateUrgencyScore(text) {
  const lowerText = text.toLowerCase();

  const criticalKeywords = [
    "emergency", "critical", "urgent", "asap", "immediately", 
    "down", "crash", "outage", "blackout", "all employees",
    "everyone", "cannot work", "halt", "stop", "entire"
  ];

  const urgentKeywords = [
    "urgent", "high priority", "severe", "major", "quickly",
    "soon", "important", "blocked", "stuck", "rush"
  ];

  const riskKeywords = [
    "risky", "risk", "potential", "could", "might", "concern",
    "warning", "issue", "problem"
  ];

  let score = 0;

  criticalKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) score += 25;
  });

  urgentKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) score += 15;
  });

  riskKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) score += 5;
  });

  return Math.min(score, 100);
}

/**
 * Generate reasoning based on analysis results
 */
function generateReasoning(categoryResult, priorityResult) {
  const reasons = [];

  reasons.push(
    `Detected ${categoryResult.category} based on semantic analysis (${categoryResult.confidence}% confidence)`
  );

  reasons.push(
    `Classified as ${priorityResult.priority} priority due to ${priorityResult.sentiment} sentiment (${priorityResult.sentimentScore}% negative)`
  );

  return reasons.join(". ");
}

/**
 * Main categorization function using Hugging Face
 */
exports.categorizeIssueWithHF = async function(title, description) {
  try {
    if (!title || !description) {
      return {
        success: false,
        message: "Title and description are required"
      };
    }

    const fullText = `${title}. ${description}`;

    console.log("\n🤖 Starting Hugging Face Analysis...");
    console.log("📝 Text:", fullText.substring(0, 100) + "...");

    // Get category and priority
    const categoryResult = await categorizeWithZeroShot(fullText);
    const priorityResult = await determinePriorityWithSentiment(fullText);

    const reasoning = generateReasoning(categoryResult, priorityResult);

    console.log("✅ Analysis complete!\n");

    return {
      success: true,
      suggestion: {
        category: categoryResult.category,
        priority: priorityResult.priority,
        confidence: categoryResult.confidence,
        reasoning,
        metadata: {
          sentiment: priorityResult.sentiment,
          sentimentScore: priorityResult.sentimentScore,
          priorityScore: priorityResult.priorityScore,
          model: "Hugging Face Zero-Shot + Sentiment Analysis"
        }
      }
    };
  } catch (error) {
    console.error("❌ Categorization error:", error.message);
    return {
      success: false,
      message: "Failed to categorize: " + error.message
    };
  }
};

console.log("✅ Hugging Face NLP Service initialized");
