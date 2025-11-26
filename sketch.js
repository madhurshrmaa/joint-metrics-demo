/* Brussels Network Visualizer
  Table III (Gontier & Wiame, 2024)
*/

// CONFIGURATION
const METERS_PER_PIXEL_SCALE = 20.0;    // 1 Pixel = 20 Meters
// Canvas 800px = 16,000m visual width.

// PHYSICAL CONSTANTS
const SPEED_OF_LIGHT_MPS = 3e8; 
const FREQUENCY_HERTZ = 1.8375e9;         // 1.83 GHz
const PATH_LOSS_CONSTANT_KAPPA = Math.pow((4 * Math.PI * FREQUENCY_HERTZ / SPEED_OF_LIGHT_MPS), 2);
const BASE_STATION_HEIGHT_METERS = 33.0;        // 33 meters
const PATH_LOSS_EXPONENT_ALPHA = 3.2;

// POWER PARAMETERS
const TRANSMIT_POWER_DBM = 62.75; 
const TRANSMIT_POWER_WATTS = Math.pow(10, (TRANSMIT_POWER_DBM - 30.0)/10.0); // ~1883 Watts
const NOISE_FLOOR_DBM = -96.21;
const NOISE_FLOOR_WATTS = Math.pow(10, (NOISE_FLOOR_DBM - 30.0)/10.0);

let baseStationRegistry = [];

function setup() {
  createCanvas(800, 600);
  drawingContext.shadowBlur = 0; // Initialize off
  textFont('Courier New');       // Standard engineering font
  
  // TOPOLOGY: BRUSSELS INHOMOGENEOUS (Gaussian Approx)
  const distributionStandardDeviationPixels = 60; // 1200m / 20px
  
  for (let stationIndex = 0; stationIndex < 75; stationIndex++) {
    // Clustered center (Gaussian), mimics Table III density
    let stationCenterX = width/2 + randomGaussian() * distributionStandardDeviationPixels; 
    let stationCenterY = height/2 + randomGaussian() * distributionStandardDeviationPixels;
    
    baseStationRegistry.push({ 
        positionVectorPixels: createVector(stationCenterX, stationCenterY), 
        positionVectorMeters: createVector(stationCenterX * METERS_PER_PIXEL_SCALE, stationCenterY * METERS_PER_PIXEL_SCALE), 
        receivedPowerAtUserWatts: 0 
    });
  }
}

function draw() {
  background(18, 18, 22); // Deep dark blue-black
  drawGridSystem();
  
  // 1. Map Mouse (Pixel) -> User (Meters)
  // Coordinates are relative to Top-Left (0,0) as world origin in pixels
  // In physics, this 0,0 is "scaled".
  let userWorldX_Meters = mouseX * METERS_PER_PIXEL_SCALE; 
  let userWorldY_Meters = mouseY * METERS_PER_PIXEL_SCALE;
  
  // 2. Compute PHYSICS
  let totalReceivedPowerSumWatts = 0;
  let strongestSignalPowerWatts = 0;
  let servingBaseStation = null;

  for (let currentBaseStation of baseStationRegistry) {
    // 2a. Distances (2D and 3D)
    let distance2D_Meters = dist(userWorldX_Meters, userWorldY_Meters, currentBaseStation.positionVectorMeters.x, currentBaseStation.positionVectorMeters.y);
    let distance3D_Squared = (distance2D_Meters * distance2D_Meters) + (BASE_STATION_HEIGHT_METERS * BASE_STATION_HEIGHT_METERS);
    
    // 2b. Eq (4) Path Loss Factor
    let pathLossAttenuation = (1.0 / PATH_LOSS_CONSTANT_KAPPA) * Math.pow(distance3D_Squared, -PATH_LOSS_EXPONENT_ALPHA / 2.0);
    
    // 2c. Eq (4) Power Received
    let powerReceivedWatts = TRANSMIT_POWER_WATTS * pathLossAttenuation; 
    
    currentBaseStation.receivedPowerAtUserWatts = powerReceivedWatts;
    totalReceivedPowerSumWatts += powerReceivedWatts;
    
    if (powerReceivedWatts > strongestSignalPowerWatts) {
      strongestSignalPowerWatts = powerReceivedWatts;
      servingBaseStation = currentBaseStation;
    }
  }

  // 3. Derived Metrics
  let interferencePowerWatts = totalReceivedPowerSumWatts - strongestSignalPowerWatts;
  // Prevent div/0 for visual stability
  let signalToInterferenceNoiseRatioLinear = strongestSignalPowerWatts / (interferencePowerWatts + NOISE_FLOOR_WATTS + 1e-20); 
  let signalToInterferenceNoiseRatioDecibels = 10 * Math.log10(signalToInterferenceNoiseRatioLinear);
  
  // Metric S: Eq (8) Conversion from Total P to Flux
  let electromagneticFluxDensity = (PATH_LOSS_CONSTANT_KAPPA / (4 * Math.PI)) * totalReceivedPowerSumWatts;

  // RENDERING
  
  // A. Base Stations
  for (let currentBaseStation of baseStationRegistry) {
    let distanceToMousePixels = dist(mouseX, mouseY, currentBaseStation.positionVectorPixels.x, currentBaseStation.positionVectorPixels.y);
    let isMouseHovering = distanceToMousePixels < 25; // Hit area
    let isServingStation = (currentBaseStation === servingBaseStation);
    
    // Determine Color
    let stationDotColor = color(255, 50, 50, 80); // Default Idle
    let stationGlowColor = color(255, 0, 0); 
    
    if (isServingStation) { 
        stationDotColor = color(0, 255, 0, 200); 
        stationGlowColor = color(0, 255, 0);
    }
    if (isMouseHovering) { 
        stationDotColor = color(0, 255, 255, 255); 
        stationGlowColor = color(0, 255, 255);
    }

    // Draw Beam (Line)
    if (isServingStation || isMouseHovering) {
      stroke(stationGlowColor);
      strokeWeight(1);
      // Faint connection line
      line(mouseX, mouseY, currentBaseStation.positionVectorPixels.x, currentBaseStation.positionVectorPixels.y);
    }

    // Draw Tower Dot
    drawingContext.shadowBlur = (isServingStation || isMouseHovering) ? 15 : 0;
    drawingContext.shadowColor = stationGlowColor.toString();
    noStroke();
    fill(stationDotColor);
    ellipse(currentBaseStation.positionVectorPixels.x, currentBaseStation.positionVectorPixels.y, isMouseHovering ? 12 : 8);
    
    // Tooltip must be last in loop to stay on top, OR separate loop.
    // It his handled after User to ensure z-index.
  }

  // B. User (The Commuter)
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = 'white';
  fill(255); ellipse(mouseX, mouseY, 10);
  noFill(); stroke(255, 50); ellipse(mouseX, mouseY, 60);

  // C. Data HUD
  drawHUD(electromagneticFluxDensity, signalToInterferenceNoiseRatioDecibels);

  // D. Tooltip (on top of everything)
  for (let currentBaseStation of baseStationRegistry) {
      if (dist(mouseX, mouseY, currentBaseStation.positionVectorPixels.x, currentBaseStation.positionVectorPixels.y) < 25) {
        drawSmartTooltip(currentBaseStation);
        break; // Show only one at a time
      }
  }
}

// UI COMPONENTS

function drawGridSystem() {
  drawingContext.shadowBlur = 0;
  stroke(255, 10); noFill();
  ellipse(width/2, height/2, 200); // 1km rings
  ellipse(width/2, height/2, 400);
  
  noStroke(); fill(124, 138, 58); textSize(15);
  textAlign(CENTER, CENTER);
  text("CITY CENTER", width/2, height/2);
}

function drawHUD(fluxDensityValue, sinrDecibelValue) {
  // Reset Glow
  drawingContext.shadowBlur = 0;

  textAlign(LEFT, BASELINE);
  
  // Background Box (Wider to fit text)
  push();
  translate(20, 20);
  fill(10, 10, 15, 240);
  stroke(60); strokeWeight(1);
  rect(0, 0, 280, 130, 8); // Widened to 280px

  // Headers
  noStroke();
  fill(150); textSize(11);
  text("SIMULATION METRICS (Table III)", 15, 25);
  
  // Divider
  stroke(40); line(15, 35, 265, 35); noStroke();

  // Metric 1: EMF FLUX (Equation 8)
  fill(200); textSize(12);
  text("EMF Flux Density (S):", 15, 60);
  
  // Risk Coloring
  let riskLevelColor = color(0, 255, 0); // Green
  if (fluxDensityValue > 1e-4) riskLevelColor = color(255, 200, 0); // Orange
  if (fluxDensityValue > 1e-3) riskLevelColor = color(255, 50, 50); // Red
  
  fill(riskLevelColor); textSize(16); textStyle(BOLD);
  // Using toExponential to keep text length predictable
  text(fluxDensityValue.toExponential(3) + " W/m²", 15, 80);

  // Metric 2: SINR (Coverage)
  fill(200); textStyle(NORMAL); textSize(12);
  text("Coverage (SINR): ", 15, 105);
  
  fill(sinrDecibelValue > 0 ? '#4CAF50' : '#F44336'); // Green/Red
  textStyle(BOLD);
  text(" " + sinrDecibelValue.toFixed(2) + " dB", 130, 105);
  
  pop();
}

function drawSmartTooltip(targetBaseStation) {
  drawingContext.shadowBlur = 0;
  
  let stationPixelX = targetBaseStation.positionVectorPixels.x;
  let stationPixelY = targetBaseStation.positionVectorPixels.y - 15;
  
  // Smart Positioning: prevent going off screen
  let tooltipWidth = 150;
  let tooltipHeight = 45;
  let tooltipX = stationPixelX - tooltipWidth/2;
  let tooltipY = stationPixelY - tooltipHeight;
  
  // Clamping
  if (tooltipX < 10) tooltipX = 10;
  if (tooltipX + tooltipWidth > width - 10) tooltipX = width - tooltipWidth - 10;
  if (tooltipY < 10) tooltipY = stationPixelY + 20; // Flip down if too high

  push();
  translate(tooltipX, tooltipY);
  
  // Box
  fill(0, 0, 0, 220); stroke(100); strokeWeight(1);
  rect(0, 0, tooltipWidth, tooltipHeight, 4);
  
  // Data
  let signalPowerDbm = 10 * Math.log10(targetBaseStation.receivedPowerAtUserWatts) + 30;
  noStroke(); fill(255); textSize(11); textStyle(NORMAL);
  text("TOWER SIGNAL:", 10, 18);
  
  fill('#00E5FF'); textStyle(BOLD);
  text(signalPowerDbm.toFixed(2) + " dBm", 10, 34);
  
  pop();
}