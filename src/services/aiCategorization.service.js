console.log("🤖 AI Categorization Service loaded");

/**
 * AI-Powered Issue Categorization Service
 * Uses Hugging Face Transformers.js for semantic analysis
 * Fallback to keyword matching if HF fails
 */

const { categorizeIssueWithHF } = require('./huggingFaceNLP.service');

const categoryKeywords = {
  "Electrical": [
    "light", "power", "electric", "plug", "socket", "wire", "bulb", "lamp", 
    "outlet", "circuit", "switch", "voltage", "breaker", "outage", "blackout"
  ],
  "Plumbing": [
    "water", "pipe", "leak", "drain", "sink", "toilet", "tap", "faucet", 
    "clog", "blocked", "burst", "valve", "sewage", "overflow"
  ],
  "Network": [
    "internet", "wifi", "network", "connection", "cable", "ethernet", "modem", 
    "router", "server", "bandwidth", "speed", "online", "offline", "disconnect"
  ],
  "HVAC": [
    "air", "heating", "cooling", "ac", "temperature", "thermostat", "ventilation",
    "warm", "cold", "fan", "conditioner", "furnace", "vent"
  ],
  "Maintenance": [
    "fix", "repair", "broken", "damage", "maintenance", "clean", "wear", "tear",
    "door", "window", "floor", "wall", "ceiling", "crack"
  ],
  "Security": [
    "lock", "security", "alarm", "camera", "access", "breach", "password", 
    "unauthorized", "hack", "virus", "malware", "surveillance"
  ]
};

const priorityKeywords = {
  "Critical": {
    keywords: [
      "critical", "emergency", "urgent", "asap", "immediately", "down", "outage",
      "crash", "failure", "halt", "stop", "complete", "total", "all", "everyone"
    ],
    baseScore: 40
  },
  "Urgent": {
    keywords: [
      "urgent", "high", "severe", "major", "significant", "important", "quickly",
      "soon", "fast", "rush", "hurry", "blocked", "stuck", "halt"
    ],
    baseScore: 30
  },
  "Risky": {
    keywords: [
      "risky", "risk", "potential", "could", "might", "possible", "concern",
      "warning", "caution", "issue", "problem", "error"
    ],
    baseScore: 20
  },
  "Routine": {
    keywords: [],
    baseScore: 10
  }
};

/**
 * Analyze text to find matching category (KEYWORD FALLBACK)
 */
function categorizeIssueKeyword(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const scores = {};

  // Initialize scores
  Object.keys(categoryKeywords).forEach(cat => {
    scores[cat] = 0;
  });

  // Score each category based on keyword matches
  Object.entries(categoryKeywords).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        scores[category] += matches.length;
      }
    });
  });

  // Find category with highest score
  let bestCategory = "Other";
  let maxScore = 0;

  Object.entries(scores).forEach(([category, score]) => {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  });

  return bestCategory;
}

/**
 * Analyze text to determine priority level
 */
function determinePriority(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const priorityScores = {};

  // Initialize base scores
  Object.entries(priorityKeywords).forEach(([priority, data]) => {
    priorityScores[priority] = data.baseScore;
  });

  // Add scores based on keyword matches
  Object.entries(priorityKeywords).forEach(([priority, data]) => {
    data.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        priorityScores[priority] += matches.length * 5;
      }
    });
  });

  // Find priority with highest score
  let bestPriority = "Routine";
  let maxScore = 0;

  Object.entries(priorityScores).forEach(([priority, score]) => {
    if (score > maxScore) {
      maxScore = score;
      bestPriority = priority;
    }
  });

  return bestPriority;
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(title, description, category) {
  const text = `${title} ${description}`.toLowerCase();
  const keywords = categoryKeywords[category] || [];
  
  let matchCount = 0;
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      matchCount += matches.length;
    }
  });

  // Calculate confidence (max 100)
  const confidence = Math.min(matchCount * 15, 100);
  return Math.round(confidence);
}

/**
 * Main categorization function
 * Uses Hugging Face with keyword fallback
 */
exports.categorizeIssue = async function(title, description, image = null) {
  try {
    if (!title || !description) {
      return {
        success: false,
        message: "Title and description are required"
      };
    }

    console.log("\n🚀 Starting AI categorization with Hugging Face...");

    // Try Hugging Face first
    try {
      const hfResult = await categorizeIssueWithHF(title, description);
      
      if (hfResult.success) {
        console.log("✅ Hugging Face categorization successful!");
        return hfResult;
      }
    } catch (hfError) {
      console.warn("⚠️ Hugging Face error:", hfError.message);
      console.log("🔄 Falling back to keyword-based categorization...");
    }

    // Fallback to keyword-based system
    const category = categorizeIssueKeyword(title, description);
    const priority = determinePriority(title, description);
    const confidence = calculateConfidence(title, description, category);

    console.log("✅ Keyword-based categorization complete (fallback)");

    return {
      success: true,
      suggestion: {
        category,
        priority,
        confidence,
        reasoning: generateReasoning(title, description, category, priority),
        model: "Keyword-based (Hugging Face unavailable)"
      }
    };
  } catch (error) {
    console.error("❌ Categorization error:", error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Generate human-readable reasoning
 */
function generateReasoning(title, description, category, priority) {
  const reasons = [];

  if (category !== "Other") {
    reasons.push(`Detected ${category} issue based on keywords in description`);
  }

  if (priority !== "Routine") {
    reasons.push(`Classified as ${priority} priority due to urgency indicators`);
  }

  if (reasons.length === 0) {
    reasons.push("Issue categorized based on content analysis");
  }

  return reasons.join(". ");
}

console.log("✅ AI Categorization Service initialized");
