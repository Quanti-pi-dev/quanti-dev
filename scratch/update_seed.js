const fs = require('fs');

const physicsRookie = [
  {
    "question": "A car accelerates from rest at 2 m/s² for 5 seconds. What is its final velocity?",
    "options": [
      { "id": "A", "text": "5 m/s" },
      { "id": "B", "text": "10 m/s" },
      { "id": "C", "text": "20 m/s" },
      { "id": "D", "text": "15 m/s" }
    ],
    "correctAnswerId": "B",
    "explanation": "Using v = u + at, where u=0, a=2, t=5. v = 0 + (2)(5) = 10 m/s.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "What is the SI unit of acceleration?",
    "options": [
      { "id": "A", "text": "m/s" },
      { "id": "B", "text": "m/s²" },
      { "id": "C", "text": "m²/s" },
      { "id": "D", "text": "m²/s²" }
    ],
    "correctAnswerId": "B",
    "explanation": "Acceleration is the rate of change of velocity, so its unit is (m/s)/s = m/s².",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "A body is thrown vertically upwards with a velocity of 20 m/s. What is the maximum height reached? (g = 10 m/s²)",
    "options": [
      { "id": "A", "text": "10 m" },
      { "id": "B", "text": "20 m" },
      { "id": "C", "text": "30 m" },
      { "id": "D", "text": "40 m" }
    ],
    "correctAnswerId": "B",
    "explanation": "Using v² = u² - 2gh. At max height, v = 0. So 0 = 20² - 20h => h = 400/20 = 20 m.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "If the velocity of an object is constant, its acceleration is:",
    "options": [
      { "id": "A", "text": "Positive" },
      { "id": "B", "text": "Negative" },
      { "id": "C", "text": "Zero" },
      { "id": "D", "text": "Variable" }
    ],
    "correctAnswerId": "C",
    "explanation": "Acceleration is the rate of change of velocity. If velocity is constant, the change is zero, so acceleration is zero.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "The area under a velocity-time graph represents:",
    "options": [
      { "id": "A", "text": "Acceleration" },
      { "id": "B", "text": "Speed" },
      { "id": "C", "text": "Displacement" },
      { "id": "D", "text": "Force" }
    ],
    "correctAnswerId": "C",
    "explanation": "The integral of velocity with respect to time (area under v-t graph) is displacement.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "A particle moves in a circle of radius R with constant speed v. The acceleration of the particle is:",
    "options": [
      { "id": "A", "text": "Zero" },
      { "id": "B", "text": "v/R" },
      { "id": "C", "text": "v²/R" },
      { "id": "D", "text": "v/R²" }
    ],
    "correctAnswerId": "C",
    "explanation": "In uniform circular motion, the centripetal acceleration is v²/R directed towards the center.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "An object covers equal distances in equal intervals of time. It is moving with:",
    "options": [
      { "id": "A", "text": "Uniform speed" },
      { "id": "B", "text": "Uniform acceleration" },
      { "id": "C", "text": "Variable speed" },
      { "id": "D", "text": "Uniform velocity" }
    ],
    "correctAnswerId": "A",
    "explanation": "Covering equal distances in equal times is the definition of uniform speed.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "A train 100m long is moving at 72 km/h. How much time will it take to cross a bridge 200m long?",
    "options": [
      { "id": "A", "text": "10 s" },
      { "id": "B", "text": "15 s" },
      { "id": "C", "text": "20 s" },
      { "id": "D", "text": "25 s" }
    ],
    "correctAnswerId": "B",
    "explanation": "Speed = 72 km/h = 20 m/s. Total distance = train length + bridge length = 100 + 200 = 300m. Time = 300 / 20 = 15 s.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "If a body travels with speed v1 for half the distance and v2 for the other half, the average speed is:",
    "options": [
      { "id": "A", "text": "(v1+v2)/2" },
      { "id": "B", "text": "2v1v2/(v1+v2)" },
      { "id": "C", "text": "v1v2/(v1+v2)" },
      { "id": "D", "text": "sqrt(v1*v2)" }
    ],
    "correctAnswerId": "B",
    "explanation": "Average speed for equal distances is the harmonic mean: 2v1v2/(v1+v2).",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "A stone is dropped from a cliff. What is its speed after 3 seconds? (g = 9.8 m/s²)",
    "options": [
      { "id": "A", "text": "9.8 m/s" },
      { "id": "B", "text": "19.6 m/s" },
      { "id": "C", "text": "29.4 m/s" },
      { "id": "D", "text": "39.2 m/s" }
    ],
    "correctAnswerId": "C",
    "explanation": "v = u + gt. v = 0 + 9.8(3) = 29.4 m/s.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "Which of the following can be zero even if the distance is not zero?",
    "options": [
      { "id": "A", "text": "Displacement" },
      { "id": "B", "text": "Speed" },
      { "id": "C", "text": "Time" },
      { "id": "D", "text": "Mass" }
    ],
    "correctAnswerId": "A",
    "explanation": "Displacement is the shortest path between start and end. If a body returns to its starting point, displacement is zero but distance is not.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "A car travelling at 20 m/s brakes and stops in 4 seconds. The deceleration is:",
    "options": [
      { "id": "A", "text": "4 m/s²" },
      { "id": "B", "text": "5 m/s²" },
      { "id": "C", "text": "8 m/s²" },
      { "id": "D", "text": "10 m/s²" }
    ],
    "correctAnswerId": "B",
    "explanation": "a = (v - u) / t = (0 - 20) / 4 = -5 m/s². The deceleration is 5 m/s².",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "The slope of a position-time graph gives:",
    "options": [
      { "id": "A", "text": "Acceleration" },
      { "id": "B", "text": "Velocity" },
      { "id": "C", "text": "Distance" },
      { "id": "D", "text": "Jerk" }
    ],
    "correctAnswerId": "B",
    "explanation": "Slope = Δx / Δt, which is the definition of velocity.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "Which of the following equations is NOT a valid equation of motion for constant acceleration?",
    "options": [
      { "id": "A", "text": "v = u + at" },
      { "id": "B", "text": "s = ut + 1/2 at²" },
      { "id": "C", "text": "v² = u² + 2as" },
      { "id": "D", "text": "v = u + 1/2 at²" }
    ],
    "correctAnswerId": "D",
    "explanation": "The correct equation is s = ut + 1/2 at², not v = u + 1/2 at².",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "If a particle moves with a constant velocity, its position-time graph is a:",
    "options": [
      { "id": "A", "text": "Parabola" },
      { "id": "B", "text": "Circle" },
      { "id": "C", "text": "Straight line" },
      { "id": "D", "text": "Hyperbola" }
    ],
    "correctAnswerId": "C",
    "explanation": "Constant velocity means constant slope, which corresponds to a straight line on a position-time graph.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "A body starts from rest. The ratio of distances covered in the 1st, 2nd, and 3rd seconds is:",
    "options": [
      { "id": "A", "text": "1:2:3" },
      { "id": "B", "text": "1:3:5" },
      { "id": "C", "text": "1:4:9" },
      { "id": "D", "text": "1:8:27" }
    ],
    "correctAnswerId": "B",
    "explanation": "Distance in nth second: Sn = u + a/2(2n-1). Since u=0, Sn ∝ (2n-1). For n=1,2,3, it is 1:3:5.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "What is the displacement of an object moving in a circular path of radius r after half a revolution?",
    "options": [
      { "id": "A", "text": "πr" },
      { "id": "B", "text": "2πr" },
      { "id": "C", "text": "2r" },
      { "id": "D", "text": "0" }
    ],
    "correctAnswerId": "C",
    "explanation": "After half a revolution, the object is at the opposite end of the diameter. Displacement = 2r.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "Two bodies of different masses m1 and m2 are dropped from the same height. If air resistance is neglected, they will reach the ground:",
    "options": [
      { "id": "A", "text": "m1 first" },
      { "id": "B", "text": "m2 first" },
      { "id": "C", "text": "Simultaneously" },
      { "id": "D", "text": "Depends on volume" }
    ],
    "correctAnswerId": "C",
    "explanation": "Acceleration due to gravity is independent of mass. So they fall at the same rate.",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "If the position of a particle is given by x = 3t² + 2t, what is its velocity at t=1s?",
    "options": [
      { "id": "A", "text": "5 m/s" },
      { "id": "B", "text": "6 m/s" },
      { "id": "C", "text": "8 m/s" },
      { "id": "D", "text": "10 m/s" }
    ],
    "correctAnswerId": "C",
    "explanation": "v = dx/dt = 6t + 2. At t=1, v = 6(1) + 2 = 8 m/s.",
    "tags": ["physics", "kinematics", "rookie", "calculus"]
  },
  {
    "question": "A ball is thrown upwards. At the highest point, its velocity and acceleration are:",
    "options": [
      { "id": "A", "text": "v = 0, a = 0" },
      { "id": "B", "text": "v ≠ 0, a = 0" },
      { "id": "C", "text": "v = 0, a ≠ 0" },
      { "id": "D", "text": "v ≠ 0, a ≠ 0" }
    ],
    "correctAnswerId": "C",
    "explanation": "At the highest point, the ball stops momentarily (v = 0), but gravity is still acting downwards (a = -g ≠ 0).",
    "tags": ["physics", "kinematics", "rookie"]
  },
  {
    "question": "The stopping distance of a car is proportional to:",
    "options": [
      { "id": "A", "text": "Velocity" },
      { "id": "B", "text": "Square of velocity" },
      { "id": "C", "text": "Square root of velocity" },
      { "id": "D", "text": "Inverse of velocity" }
    ],
    "correctAnswerId": "B",
    "explanation": "Using v² = u² + 2as. If v=0, s = -u² / (2a). Thus stopping distance is proportional to u².",
    "tags": ["physics", "kinematics", "rookie"]
  }
];

const physicsSkilled = [
  {
    "question": "A body is dropped from a tower of height 80m. How long does it take to reach the ground? (g = 10 m/s²)",
    "options": [
      { "id": "A", "text": "2 s" },
      { "id": "B", "text": "3 s" },
      { "id": "C", "text": "4 s" },
      { "id": "D", "text": "5 s" }
    ],
    "correctAnswerId": "C",
    "explanation": "Using h = 1/2 gt². 80 = 1/2 (10) t² => 80 = 5t² => t² = 16 => t = 4 s.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "The area under an acceleration-time graph gives:",
    "options": [
      { "id": "A", "text": "Velocity" },
      { "id": "B", "text": "Change in velocity" },
      { "id": "C", "text": "Displacement" },
      { "id": "D", "text": "Change in acceleration" }
    ],
    "correctAnswerId": "B",
    "explanation": "∫ a dt = Δv. The area represents the change in velocity, not the absolute velocity.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A projectile is fired at an angle of 30° to the horizontal with velocity u. Its time of flight is:",
    "options": [
      { "id": "A", "text": "u / g" },
      { "id": "B", "text": "u / 2g" },
      { "id": "C", "text": "2u / g" },
      { "id": "D", "text": "u√3 / g" }
    ],
    "correctAnswerId": "A",
    "explanation": "T = 2u sinθ / g. sin(30°) = 1/2. T = 2u(1/2) / g = u / g.",
    "tags": ["physics", "kinematics", "skilled", "projectile"]
  },
  {
    "question": "Two cars A and B are moving in the same direction with speeds 40 km/h and 60 km/h respectively. The relative velocity of B w.r.t A is:",
    "options": [
      { "id": "A", "text": "20 km/h" },
      { "id": "B", "text": "100 km/h" },
      { "id": "C", "text": "-20 km/h" },
      { "id": "D", "text": "2400 km/h" }
    ],
    "correctAnswerId": "A",
    "explanation": "V_BA = V_B - V_A = 60 - 40 = 20 km/h.",
    "tags": ["physics", "kinematics", "skilled", "relative-motion"]
  },
  {
    "question": "A balloon is moving upwards at 10 m/s. A stone is dropped from it when it is at a height of 75m. What is the initial velocity of the stone relative to the ground?",
    "options": [
      { "id": "A", "text": "0 m/s" },
      { "id": "B", "text": "10 m/s upwards" },
      { "id": "C", "text": "10 m/s downwards" },
      { "id": "D", "text": "75 m/s upwards" }
    ],
    "correctAnswerId": "B",
    "explanation": "The stone acquires the velocity of the balloon at the moment it is dropped. So it is 10 m/s upwards.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "The horizontal range of a projectile is R. What is the maximum height attained if it was projected at 45°?",
    "options": [
      { "id": "A", "text": "R" },
      { "id": "B", "text": "R/2" },
      { "id": "C", "text": "R/4" },
      { "id": "D", "text": "2R" }
    ],
    "correctAnswerId": "C",
    "explanation": "R = u²sin(90°)/g = u²/g. Max height H = u²sin²(45°)/2g = u²(1/2)/2g = u²/4g = R/4.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A particle moves such that x = 2t² and y = 4t. The path of the particle is:",
    "options": [
      { "id": "A", "text": "Straight line" },
      { "id": "B", "text": "Parabola" },
      { "id": "C", "text": "Circle" },
      { "id": "D", "text": "Ellipse" }
    ],
    "correctAnswerId": "B",
    "explanation": "From y = 4t, we get t = y/4. Substitute in x: x = 2(y/4)² = 2(y²/16) = y²/8. This is the equation of a parabola (y² = 8x).",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "If a particle covers half the circle of radius R in time T, its average velocity is:",
    "options": [
      { "id": "A", "text": "πR / T" },
      { "id": "B", "text": "2R / T" },
      { "id": "C", "text": "R / T" },
      { "id": "D", "text": "0" }
    ],
    "correctAnswerId": "B",
    "explanation": "Average velocity = Displacement / Time. Displacement across half a circle is the diameter, 2R. So v_avg = 2R / T.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "Two bullets are fired simultaneously, horizontally and with different speeds from the same place. Which bullet will hit the ground first?",
    "options": [
      { "id": "A", "text": "The faster one" },
      { "id": "B", "text": "The slower one" },
      { "id": "C", "text": "Both will reach simultaneously" },
      { "id": "D", "text": "Depends on mass" }
    ],
    "correctAnswerId": "C",
    "explanation": "Vertical motion is independent of horizontal velocity. Since both start with 0 vertical velocity, they hit the ground at the same time: t = sqrt(2h/g).",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A particle is projected horizontally with speed u from height h. The equation of its trajectory is:",
    "options": [
      { "id": "A", "text": "y = gx² / (2u²)" },
      { "id": "B", "text": "y = 2gx² / u²" },
      { "id": "C", "text": "y = gx / u" },
      { "id": "D", "text": "y = gx² / u²" }
    ],
    "correctAnswerId": "A",
    "explanation": "x = ut => t = x/u. Vertical drop y = 1/2 gt² = 1/2 g (x/u)² = gx² / (2u²).",
    "tags": ["physics", "kinematics", "skilled", "projectile"]
  },
  {
    "question": "A body starts from rest and moves with uniform acceleration. The velocity-displacement graph is a:",
    "options": [
      { "id": "A", "text": "Straight line" },
      { "id": "B", "text": "Parabola" },
      { "id": "C", "text": "Circle" },
      { "id": "D", "text": "Curve of the form v ∝ √s" }
    ],
    "correctAnswerId": "D",
    "explanation": "Using v² = u² + 2as. Since u=0, v² = 2as, so v = √(2as). The graph is a parabola (opening along the s-axis), meaning v ∝ √s.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A stone is thrown vertically downwards with velocity u from a height h. The velocity with which it hits the ground is:",
    "options": [
      { "id": "A", "text": "√(u² + 2gh)" },
      { "id": "B", "text": "√(u² - 2gh)" },
      { "id": "C", "text": "u + √(2gh)" },
      { "id": "D", "text": "√(2gh)" }
    ],
    "correctAnswerId": "A",
    "explanation": "Using v² = u² + 2as. Here a = g, s = h. So v² = u² + 2gh => v = √(u² + 2gh).",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A person swims directly across a river of width d and velocity v_r. If his speed relative to water is v_s, the drift downstream is:",
    "options": [
      { "id": "A", "text": "d (v_r / v_s)" },
      { "id": "B", "text": "d (v_s / v_r)" },
      { "id": "C", "text": "d √(v_s² + v_r²)" },
      { "id": "D", "text": "d" }
    ],
    "correctAnswerId": "A",
    "explanation": "Time to cross = d / v_s. Drift = v_r * time = v_r * (d / v_s) = d (v_r / v_s).",
    "tags": ["physics", "kinematics", "skilled", "relative-motion"]
  },
  {
    "question": "A projectile reaches a maximum height H and has a range R. The angle of projection is given by tanθ = ?",
    "options": [
      { "id": "A", "text": "4H / R" },
      { "id": "B", "text": "H / 4R" },
      { "id": "C", "text": "2H / R" },
      { "id": "D", "text": "H / 2R" }
    ],
    "correctAnswerId": "A",
    "explanation": "R = u²sin(2θ)/g = 2u²sinθcosθ/g. H = u²sin²θ/2g. H/R = (u²sin²θ/2g) / (2u²sinθcosθ/g) = tanθ / 4. Thus tanθ = 4H/R.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A body is accelerating uniformly. Its velocity increases from 10 m/s to 20 m/s over a distance of 150m. The acceleration is:",
    "options": [
      { "id": "A", "text": "1 m/s²" },
      { "id": "B", "text": "2 m/s²" },
      { "id": "C", "text": "1.5 m/s²" },
      { "id": "D", "text": "3 m/s²" }
    ],
    "correctAnswerId": "A",
    "explanation": "v² = u² + 2as. 400 = 100 + 2(a)(150) => 300 = 300a => a = 1 m/s².",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "Velocity is given by v = at + bt². The dimensional formula for b is:",
    "options": [
      { "id": "A", "text": "[LT⁻¹]" },
      { "id": "B", "text": "[LT⁻²]" },
      { "id": "C", "text": "[LT⁻³]" },
      { "id": "D", "text": "[L²T⁻²]" }
    ],
    "correctAnswerId": "C",
    "explanation": "According to the principle of homogeneity, the dimensions of bt² must be the same as v [LT⁻¹]. Thus, [b][T²] = [LT⁻¹] => [b] = [LT⁻³].",
    "tags": ["physics", "kinematics", "skilled", "dimensions"]
  },
  {
    "question": "For a given velocity of projection, the horizontal range is the same for two angles of projection. These angles are:",
    "options": [
      { "id": "A", "text": "θ and 180°-θ" },
      { "id": "B", "text": "θ and 90°-θ" },
      { "id": "C", "text": "θ and 60°-θ" },
      { "id": "D", "text": "θ and 45°-θ" }
    ],
    "correctAnswerId": "B",
    "explanation": "Range R ∝ sin(2θ). Since sin(2(90°-θ)) = sin(180°-2θ) = sin(2θ), complementary angles give the same range.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A ball is thrown upward with velocity u. It reaches a height h. If it is thrown with velocity 2u, the new maximum height will be:",
    "options": [
      { "id": "A", "text": "2h" },
      { "id": "B", "text": "4h" },
      { "id": "C", "text": "h" },
      { "id": "D", "text": "8h" }
    ],
    "correctAnswerId": "B",
    "explanation": "Max height h = u² / 2g. If u becomes 2u, h' = (2u)² / 2g = 4u² / 2g = 4h.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "At the highest point of its trajectory, a projectile has:",
    "options": [
      { "id": "A", "text": "Maximum kinetic energy" },
      { "id": "B", "text": "Minimum kinetic energy" },
      { "id": "C", "text": "Zero potential energy" },
      { "id": "D", "text": "Zero velocity" }
    ],
    "correctAnswerId": "B",
    "explanation": "At the highest point, vertical velocity is zero, and horizontal velocity is v_cosθ. The speed is minimum, so kinetic energy is minimum.",
    "tags": ["physics", "kinematics", "skilled", "energy"]
  },
  {
    "question": "A stone dropped from the top of a tower falls the last half of the height in 1 second. What is the total time of fall?",
    "options": [
      { "id": "A", "text": "2 + √2 s" },
      { "id": "B", "text": "2 - √2 s" },
      { "id": "C", "text": "2 s" },
      { "id": "D", "text": "3 s" }
    ],
    "correctAnswerId": "A",
    "explanation": "Total height H = 1/2 g T². Time to fall H/2 is T-1. So H/2 = 1/2 g (T-1)². Dividing the two: 2 = T² / (T-1)² => √2 = T / (T-1) => T√2 - √2 = T => T(√2 - 1) = √2 => T = √2 / (√2 - 1) = √2(√2 + 1) / 1 = 2 + √2 s.",
    "tags": ["physics", "kinematics", "skilled"]
  },
  {
    "question": "A point moves along a straight line with deceleration proportional to its speed. The distance covered before stopping is proportional to:",
    "options": [
      { "id": "A", "text": "Initial velocity" },
      { "id": "B", "text": "Square of initial velocity" },
      { "id": "C", "text": "Square root of initial velocity" },
      { "id": "D", "text": "Independent of initial velocity" }
    ],
    "correctAnswerId": "A",
    "explanation": "a = -kv => v(dv/ds) = -kv => dv/ds = -k => ∫dv = -k∫ds => v - u = -ks. When it stops, v=0, so s = u/k. Thus s is proportional to the initial velocity u.",
    "tags": ["physics", "kinematics", "skilled"]
  }
];

const physicsExpert = [
  {
    "question": "A projectile is launched with velocity v at angle θ. If the range is maximum, what is θ?",
    "options": [
      { "id": "A", "text": "30°" },
      { "id": "B", "text": "45°" },
      { "id": "C", "text": "60°" },
      { "id": "D", "text": "90°" }
    ],
    "correctAnswerId": "B",
    "explanation": "Range R = (v² sin 2θ) / g. Max range occurs when sin 2θ = 1, so 2θ = 90°, meaning θ = 45°.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "A particle's velocity is given by v = a√x. How does its position x depend on time t?",
    "options": [
      { "id": "A", "text": "x ∝ t" },
      { "id": "B", "text": "x ∝ t²" },
      { "id": "C", "text": "x ∝ t³" },
      { "id": "D", "text": "x ∝ e^t" }
    ],
    "correctAnswerId": "B",
    "explanation": "dx/dt = a x^(1/2) => x^(-1/2) dx = a dt. Integrating gives 2x^(1/2) = at, so x = (a²t²)/4. Thus x ∝ t².",
    "tags": ["physics", "kinematics", "expert", "calculus"]
  },
  {
    "question": "A river is flowing at 3 km/h. A boat can travel at 5 km/h in still water. If the boat wants to cross the river straight across, what angle upstream from the shortest path must it head?",
    "options": [
      { "id": "A", "text": "sin⁻¹(3/5)" },
      { "id": "B", "text": "tan⁻¹(3/5)" },
      { "id": "C", "text": "sin⁻¹(4/5)" },
      { "id": "D", "text": "cos⁻¹(3/5)" }
    ],
    "correctAnswerId": "A",
    "explanation": "To go straight across, the downstream velocity of the river must be canceled by the upstream component of the boat's velocity. V_boat * sin(θ) = V_river. 5*sin(θ) = 3 => θ = sin⁻¹(3/5).",
    "tags": ["physics", "kinematics", "expert", "relative-motion"]
  },
  {
    "question": "For a projectile launched on a horizontal plane, the ratio of maximum height to time of flight squared (H / T²) is:",
    "options": [
      { "id": "A", "text": "g / 2" },
      { "id": "B", "text": "g / 4" },
      { "id": "C", "text": "g / 8" },
      { "id": "D", "text": "g" }
    ],
    "correctAnswerId": "C",
    "explanation": "H = (u²sin²θ)/(2g), T = (2usinθ)/g. T² = (4u²sin²θ)/g². H/T² = [(u²sin²θ)/(2g)] / [(4u²sin²θ)/g²] = g/8.",
    "tags": ["physics", "kinematics", "expert", "projectile"]
  },
  {
    "question": "A man running at 8 km/h finds the rain falling vertically. When he increases his speed to 12 km/h, he finds the rain makes 30° with the vertical. The speed of rain relative to ground is:",
    "options": [
      { "id": "A", "text": "4√3 km/h" },
      { "id": "B", "text": "8 km/h" },
      { "id": "C", "text": "4√7 km/h" },
      { "id": "D", "text": "10 km/h" }
    ],
    "correctAnswerId": "C",
    "explanation": "Let rain velocity V_r = a i + b j. Since it appears vertical to a man at 8 i, a = 8. So V_r = 8 i - v_y j. When man is 12 i, relative velocity is (8-12) i - v_y j = -4 i - v_y j. Angle 30° with vertical: tan(30°) = 4 / v_y => 1/√3 = 4/v_y => v_y = 4√3. V_r speed = √(8² + (4√3)²) = √(64 + 48) = √112 = 4√7.",
    "tags": ["physics", "kinematics", "expert", "relative-motion"]
  },
  {
    "question": "Two projectiles are fired at angles θ and (90-θ) with same initial speed. What is the ratio of their maximum heights?",
    "options": [
      { "id": "A", "text": "1:1" },
      { "id": "B", "text": "tan²θ : 1" },
      { "id": "C", "text": "1 : tan²θ" },
      { "id": "D", "text": "sin²θ : 1" }
    ],
    "correctAnswerId": "B",
    "explanation": "H1 = u²sin²θ/2g, H2 = u²sin²(90-θ)/2g = u²cos²θ/2g. H1/H2 = sin²θ/cos²θ = tan²θ.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "An object moves with velocity v = αt i + β j. The equation of its trajectory (y as a function of x) is:",
    "options": [
      { "id": "A", "text": "y = x²" },
      { "id": "B", "text": "y ∝ √x" },
      { "id": "C", "text": "y ∝ x" },
      { "id": "D", "text": "y ∝ x³" }
    ],
    "correctAnswerId": "B",
    "explanation": "dx/dt = αt => x = αt²/2. dy/dt = β => y = βt. From y = βt, t = y/β. Substitute into x: x = α(y/β)²/2. Thus x ∝ y², meaning y ∝ √x.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "Two particles A and B are separated by a distance d. A is moving towards B with velocity u, and B is moving perpendicular to the initial line joining them with velocity v. When will they be closest?",
    "options": [
      { "id": "A", "text": "ud / (u²+v²)" },
      { "id": "B", "text": "vd / (u²+v²)" },
      { "id": "C", "text": "d / √(u²+v²)" },
      { "id": "D", "text": "d / u" }
    ],
    "correctAnswerId": "A",
    "explanation": "Let A start at (0,0) and B at (d,0). Velocity of A is (u, 0) and B is (0, v). Position of A = (ut, 0). Position of B = (d, vt). Distance square S² = (d - ut)² + (vt)². To minimize S², d(S²)/dt = 2(d-ut)(-u) + 2(vt)(v) = 0. -ud + u²t + v²t = 0 => t = ud / (u²+v²).",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "A monkey drops from a branch at the exact moment a hunter shoots at it aiming directly at the monkey. Assuming no air resistance, the bullet will:",
    "options": [
      { "id": "A", "text": "Hit the monkey" },
      { "id": "B", "text": "Pass above the monkey" },
      { "id": "C", "text": "Pass below the monkey" },
      { "id": "D", "text": "Depends on initial speed" }
    ],
    "correctAnswerId": "A",
    "explanation": "Both the monkey and the bullet accelerate downwards at g. Relative to a frame accelerating at g, both move in straight lines. Since the bullet was aimed at the monkey, it will hit it.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "What is the radius of curvature of the trajectory of a projectile at its highest point?",
    "options": [
      { "id": "A", "text": "v²cos²θ / g" },
      { "id": "B", "text": "v²sin²θ / g" },
      { "id": "C", "text": "v² / g" },
      { "id": "D", "text": "v² / (g cosθ)" }
    ],
    "correctAnswerId": "A",
    "explanation": "At the highest point, speed is v_x = v cosθ. The acceleration perpendicular to velocity is g. Centripetal acceleration a_c = v_x² / R => g = (v cosθ)² / R => R = v²cos²θ / g.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "A particle moves such that its position vector is r = cos(ωt) i + sin(ωt) j. The velocity vector is:",
    "options": [
      { "id": "A", "text": "Parallel to r" },
      { "id": "B", "text": "Perpendicular to r" },
      { "id": "C", "text": "Directed towards origin" },
      { "id": "D", "text": "Zero" }
    ],
    "correctAnswerId": "B",
    "explanation": "This describes uniform circular motion. The velocity v = dr/dt = -ω sin(ωt) i + ω cos(ωt) j. The dot product r·v = -ωsin(ωt)cos(ωt) + ωsin(ωt)cos(ωt) = 0. So v is perpendicular to r.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "A ball is dropped from a height h. If the coefficient of restitution is e, what is the total distance covered before it stops bouncing?",
    "options": [
      { "id": "A", "text": "h(1+e²)/(1-e²)" },
      { "id": "B", "text": "h(1+e)/(1-e)" },
      { "id": "C", "text": "h/(1-e²)" },
      { "id": "D", "text": "h e² / (1-e²)" }
    ],
    "correctAnswerId": "A",
    "explanation": "Total distance = h + 2e²h + 2e⁴h + ... = h + 2e²h / (1-e²) = h [1 + 2e²/(1-e²)] = h(1+e²)/(1-e²).",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "If a particle moves in a 1D potential V(x) = kx² / 2, and starts from rest at x=A, its velocity v as a function of x is:",
    "options": [
      { "id": "A", "text": "√[k/m (A² - x²)]" },
      { "id": "B", "text": "k/m (A² - x²)" },
      { "id": "C", "text": "√[k/m x²]" },
      { "id": "D", "text": "√[2k/m (A-x)]" }
    ],
    "correctAnswerId": "A",
    "explanation": "By energy conservation, Total Energy = kA²/2. At x, E = mv²/2 + kx²/2. So mv²/2 = k/2 (A² - x²) => v = √[k/m (A² - x²)].",
    "tags": ["physics", "kinematics", "expert", "energy"]
  },
  {
    "question": "A point moves with deceleration proportional to its velocity. Its velocity varies with distance x as:",
    "options": [
      { "id": "A", "text": "v = v₀ - kx" },
      { "id": "B", "text": "v = v₀ e^(-kx)" },
      { "id": "C", "text": "v = v₀ / x" },
      { "id": "D", "text": "v = v₀ - kx²" }
    ],
    "correctAnswerId": "A",
    "explanation": "a = -kv. Since a = v(dv/dx), we have v(dv/dx) = -kv => dv/dx = -k. Integrating gives v = -kx + C. At x=0, v=v₀, so C=v₀. Thus v = v₀ - kx.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "An airplane flies from A to B and back. The speed of the plane in still air is v, and the wind blows with speed u parallel to AB. The total time taken compared to no wind is:",
    "options": [
      { "id": "A", "text": "Greater" },
      { "id": "B", "text": "Smaller" },
      { "id": "C", "text": "Equal" },
      { "id": "D", "text": "Depends on distance" }
    ],
    "correctAnswerId": "A",
    "explanation": "Time without wind: 2d/v. Time with wind: d/(v+u) + d/(v-u) = (d(v-u) + d(v+u))/(v²-u²) = 2dv/(v²-u²). Since v²-u² < v², the time with wind is greater.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "A particle is projected on an inclined plane of angle α. If the angle of projection with respect to the horizontal is θ, the condition for maximum range on the incline is:",
    "options": [
      { "id": "A", "text": "θ = π/4 + α/2" },
      { "id": "B", "text": "θ = π/4 - α/2" },
      { "id": "C", "text": "θ = π/4" },
      { "id": "D", "text": "θ = π/2 - α" }
    ],
    "correctAnswerId": "A",
    "explanation": "For an inclined plane, the angle of projection from the horizontal for maximum range is θ = π/4 + α/2.",
    "tags": ["physics", "kinematics", "expert", "projectile"]
  },
  {
    "question": "The coordinates of a moving particle at any time t are x = αt³ and y = βt³. The speed of the particle at time t is:",
    "options": [
      { "id": "A", "text": "3t²√(α²+β²)" },
      { "id": "B", "text": "t²√(α²+β²)" },
      { "id": "C", "text": "3t√(α²+β²)" },
      { "id": "D", "text": "√(α²+β²)" }
    ],
    "correctAnswerId": "A",
    "explanation": "v_x = dx/dt = 3αt². v_y = dy/dt = 3βt². Speed v = √(v_x² + v_y²) = √((3αt²)² + (3βt²)²) = 3t²√(α²+β²).",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "A body is thrown with velocity u at an angle θ. The time after which its velocity becomes perpendicular to its initial velocity is:",
    "options": [
      { "id": "A", "text": "u / (g sinθ)" },
      { "id": "B", "text": "u / (g cosθ)" },
      { "id": "C", "text": "u sinθ / g" },
      { "id": "D", "text": "u cosθ / g" }
    ],
    "correctAnswerId": "A",
    "explanation": "Initial velocity vector u = u cosθ i + u sinθ j. Velocity at time t is v = u cosθ i + (u sinθ - gt) j. For u ⊥ v, u·v = 0. So (u cosθ)(u cosθ) + (u sinθ)(u sinθ - gt) = 0 => u²cos²θ + u²sin²θ - u sinθ gt = 0 => u² - u sinθ gt = 0 => t = u / (g sinθ).",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "An elevator is accelerating upwards at a. A coin is dropped from a height h inside. The time taken to reach the floor is:",
    "options": [
      { "id": "A", "text": "√(2h / g)" },
      { "id": "B", "text": "√(2h / (g+a))" },
      { "id": "C", "text": "√(2h / (g-a))" },
      { "id": "D", "text": "√(h / (g+a))" }
    ],
    "correctAnswerId": "B",
    "explanation": "Relative to the elevator, the downward acceleration is g_eff = g + a. Using s = ut + 1/2 at², h = 1/2 (g+a) t² => t = √(2h / (g+a)).",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "A body is constrained to move along the y-axis with velocity v = k y. What is the acceleration?",
    "options": [
      { "id": "A", "text": "k² y" },
      { "id": "B", "text": "k y²" },
      { "id": "C", "text": "k" },
      { "id": "D", "text": "k²" }
    ],
    "correctAnswerId": "A",
    "explanation": "a = v(dv/dy). Since v = k y, dv/dy = k. Therefore a = (k y) * k = k² y.",
    "tags": ["physics", "kinematics", "expert"]
  },
  {
    "question": "In 1D motion, the velocity v and position x are related by v² = 108 - 9x². The motion is:",
    "options": [
      { "id": "A", "text": "Uniform" },
      { "id": "B", "text": "Uniformly accelerated" },
      { "id": "C", "text": "Simple Harmonic Motion" },
      { "id": "D", "text": "Projectile" }
    ],
    "correctAnswerId": "C",
    "explanation": "Differentiating w.r.t x: 2v(dv/dx) = -18x => a = -9x. Since a ∝ -x, it is Simple Harmonic Motion.",
    "tags": ["physics", "kinematics", "expert", "shm"]
  }
];

const physicsMaster = [
  {
    "question": "A particle is moving in a plane with a constant acceleration a directed towards a fixed point. If its velocity is v and r is the distance from the point, which quantity is conserved?",
    "options": [
      { "id": "A", "text": "Energy" },
      { "id": "B", "text": "Linear Momentum" },
      { "id": "C", "text": "Angular Momentum" },
      { "id": "D", "text": "None" }
    ],
    "correctAnswerId": "C",
    "explanation": "Since the force (and acceleration) is always directed towards a fixed point (central force), the torque is zero. Hence, angular momentum is conserved.",
    "tags": ["physics", "kinematics", "master", "central-force"]
  },
  {
    "question": "A flexible chain of length L and mass M rests on a smooth table with a length l hanging over the edge. What is the velocity of the chain when it completely leaves the table?",
    "options": [
      { "id": "A", "text": "√[g/L (L² - l²)]" },
      { "id": "B", "text": "√[g (L - l)]" },
      { "id": "C", "text": "√[g/L (L - l)²]" },
      { "id": "D", "text": "√[gL]" }
    ],
    "correctAnswerId": "A",
    "explanation": "Using conservation of energy: Initial PE = -mg(l/2)*(l/L). Final PE = -mg(L/2). Loss in PE = mgL/2 - mgl²/(2L) = Gain in KE = 1/2 mv². v = √[g/L (L² - l²)].",
    "tags": ["physics", "kinematics", "master", "energy"]
  },
  {
    "question": "A body of mass m is thrown upwards in a medium where the resistive force is kv². The maximum height reached if projected with velocity u is:",
    "options": [
      { "id": "A", "text": "m/(2k) ln(1 + ku²/mg)" },
      { "id": "B", "text": "m/k ln(1 + ku²/mg)" },
      { "id": "C", "text": "m/(2k) ln(1 - ku²/mg)" },
      { "id": "D", "text": "u²/(2g)" }
    ],
    "correctAnswerId": "A",
    "explanation": "Net force F = -mg - kv² => ma = -mg - kv². mv(dv/dx) = -mg - kv². dx = -mv dv / (mg+kv²). Integrating from u to 0 gives x = m/(2k) ln(1 + ku²/mg).",
    "tags": ["physics", "kinematics", "master", "calculus"]
  },
  {
    "question": "A particle moves such that its acceleration is given by a = -ω²x. The time period of this motion is:",
    "options": [
      { "id": "A", "text": "2π/ω" },
      { "id": "B", "text": "π/ω" },
      { "id": "C", "text": "ω/2π" },
      { "id": "D", "text": "2πω" }
    ],
    "correctAnswerId": "A",
    "explanation": "This is the standard equation for Simple Harmonic Motion. The angular frequency is ω, so T = 2π/ω.",
    "tags": ["physics", "kinematics", "master", "shm"]
  },
  {
    "question": "A projectile is thrown from the foot of an inclined plane of inclination α. If it hits the plane perpendicularly, the angle of projection θ (with the horizontal) is given by:",
    "options": [
      { "id": "A", "text": "tanθ = cotα" },
      { "id": "B", "text": "tanθ = 2cotα + tanα" },
      { "id": "C", "text": "tanθ = cotα + 2tanα" },
      { "id": "D", "text": "tanθ = 2cotα" }
    ],
    "correctAnswerId": "B",
    "explanation": "For hitting perpendicularly, the component of velocity parallel to the incline must be zero at impact. Using components along and perpendicular to the incline leads to the condition cot(θ-α) = 2tanα, which simplifies to tanθ = 2cotα + tanα.",
    "tags": ["physics", "kinematics", "master", "projectile"]
  },
  {
    "question": "Two cars are moving in a circle of radius R with constant speeds. Car A covers a full circle in T, Car B in 2T. If they start from the same point in the same direction, when will they meet for the first time?",
    "options": [
      { "id": "A", "text": "T" },
      { "id": "B", "text": "2T" },
      { "id": "C", "text": "3T" },
      { "id": "D", "text": "4T" }
    ],
    "correctAnswerId": "B",
    "explanation": "Relative angular velocity ω_rel = ω_A - ω_B = 2π/T - 2π/(2T) = π/T. Time to meet = 2π / ω_rel = 2π / (π/T) = 2T.",
    "tags": ["physics", "kinematics", "master", "circular-motion"]
  },
  {
    "question": "A drop of water falls from the roof of a building of height H at regular intervals. When the first drop reaches the ground, the 3rd drop is just leaving the roof. What is the height of the 2nd drop from the ground?",
    "options": [
      { "id": "A", "text": "H/2" },
      { "id": "B", "text": "H/4" },
      { "id": "C", "text": "3H/4" },
      { "id": "D", "text": "H/3" }
    ],
    "correctAnswerId": "C",
    "explanation": "Let the interval be t. Time for 1st drop is 2t. H = 1/2 g (2t)² = 2gt². Distance fallen by 2nd drop is 1/2 g (t)² = gt² / 2. Since 2gt² = H, the fall is H/4. Height from ground is H - H/4 = 3H/4.",
    "tags": ["physics", "kinematics", "master"]
  },
  {
    "question": "A boat crosses a river of width W. The velocity of the boat relative to the water is v, and the river velocity is u (u > v). What is the minimum possible drift?",
    "options": [
      { "id": "A", "text": "W (u/v)" },
      { "id": "B", "text": "W (u² - v²)^(1/2) / v" },
      { "id": "C", "text": "W (u² + v²)^(1/2) / v" },
      { "id": "D", "text": "W (u/v - 1)" }
    ],
    "correctAnswerId": "B",
    "explanation": "Since u > v, zero drift is impossible. To minimize drift x, set dx/dθ = 0. The minimum drift occurs when sinθ = v/u, and the drift is W √(u²/v² - 1).",
    "tags": ["physics", "kinematics", "master", "relative-motion"]
  },
  {
    "question": "If the acceleration of a particle is a = a₀ (1 - t/T), where a₀ and T are constants. The particle starts from rest at t=0. What is its velocity when acceleration is zero?",
    "options": [
      { "id": "A", "text": "a₀T" },
      { "id": "B", "text": "a₀T / 2" },
      { "id": "C", "text": "a₀T / 3" },
      { "id": "D", "text": "2a₀T" }
    ],
    "correctAnswerId": "B",
    "explanation": "Acceleration is zero at t = T. v = ∫a dt = a₀ (t - t²/2T). At t = T, v = a₀(T - T/2) = a₀T/2.",
    "tags": ["physics", "kinematics", "master"]
  },
  {
    "question": "A particle is projected with a velocity such that its range on a horizontal plane is twice the greatest height attained. What is the angle of projection?",
    "options": [
      { "id": "A", "text": "tan⁻¹(1/2)" },
      { "id": "B", "text": "tan⁻¹(2)" },
      { "id": "C", "text": "tan⁻¹(1/4)" },
      { "id": "D", "text": "tan⁻¹(4)" }
    ],
    "correctAnswerId": "B",
    "explanation": "R = 2H => u²sin(2θ)/g = 2 (u²sin²θ/2g) => 2sinθcosθ = sin²θ => tanθ = 2.",
    "tags": ["physics", "kinematics", "master", "projectile"]
  },
  {
    "question": "A bead is free to slide down a smooth wire stretched between two points A and B in a vertical plane. The time of descent is minimum when the wire is:",
    "options": [
      { "id": "A", "text": "A straight line" },
      { "id": "B", "text": "An arc of a circle" },
      { "id": "C", "text": "A cycloid" },
      { "id": "D", "text": "A parabola" }
    ],
    "correctAnswerId": "C",
    "explanation": "This is the classic Brachistochrone problem. The curve of fastest descent between two points in a gravitational field is a cycloid.",
    "tags": ["physics", "kinematics", "master", "brachistochrone"]
  },
  {
    "question": "The velocity v of a particle as a function of position x is given by v = α/x. The time taken to travel from x=a to x=b is:",
    "options": [
      { "id": "A", "text": "(b²-a²) / 2α" },
      { "id": "B", "text": "(b-a) / α" },
      { "id": "C", "text": "α ln(b/a)" },
      { "id": "D", "text": "(b²-a²) / α" }
    ],
    "correctAnswerId": "A",
    "explanation": "v = dx/dt = α/x => x dx = α dt. Integrating from x=a to b gives 1/2 (b² - a²) = α t => t = (b² - a²) / 2α.",
    "tags": ["physics", "kinematics", "master", "calculus"]
  },
  {
    "question": "An object is thrown vertically with velocity u. A second object is dropped from the maximum height of the first object at the exact moment the first object is thrown. At what height will they meet?",
    "options": [
      { "id": "A", "text": "3u² / 8g" },
      { "id": "B", "text": "u² / 4g" },
      { "id": "C", "text": "u² / 8g" },
      { "id": "D", "text": "u² / 2g" }
    ],
    "correctAnswerId": "A",
    "explanation": "Max height H = u²/2g. First object y1 = ut - 1/2 gt². Second object y2 = H - 1/2 gt². They meet when y1 = y2 => ut = H => t = H/u = u/2g. Meeting height y1 = u(u/2g) - 1/2 g (u/2g)² = u²/2g - u²/8g = 3u²/8g.",
    "tags": ["physics", "kinematics", "master"]
  },
  {
    "question": "A particle moves in the xy-plane with velocity v = k(y i + x j). The equation of its trajectory is:",
    "options": [
      { "id": "A", "text": "y = x" },
      { "id": "B", "text": "y² = x² + C" },
      { "id": "C", "text": "xy = C" },
      { "id": "D", "text": "y = x² + C" }
    ],
    "correctAnswerId": "B",
    "explanation": "dx/dt = ky, dy/dt = kx. Therefore, dy/dx = (kx) / (ky) = x / y. Separating variables gives y dy = x dx => y²/2 = x²/2 + C' => y² - x² = C.",
    "tags": ["physics", "kinematics", "master"]
  },
  {
    "question": "A wheel of radius R rolls without slipping on a horizontal surface with speed v. The velocity of a point on the rim at an angle θ from the vertical contact point is:",
    "options": [
      { "id": "A", "text": "2v sin(θ/2)" },
      { "id": "B", "text": "v sin(θ/2)" },
      { "id": "C", "text": "2v cos(θ/2)" },
      { "id": "D", "text": "v √2" }
    ],
    "correctAnswerId": "A",
    "explanation": "The distance from the instantaneous axis of rotation (contact point) is r = 2R sin(θ/2). The angular velocity is ω = v/R. Velocity V = ω r = (v/R) * 2R sin(θ/2) = 2v sin(θ/2).",
    "tags": ["physics", "kinematics", "master", "rigid-body"]
  },
  {
    "question": "A target is moving horizontally with a constant velocity v. A gun aimed directly at the target fires a bullet with velocity u. To hit the target, what should be the condition?",
    "options": [
      { "id": "A", "text": "u > v" },
      { "id": "B", "text": "u < v" },
      { "id": "C", "text": "u = v" },
      { "id": "D", "text": "Impossible to hit if aimed directly" }
    ],
    "correctAnswerId": "D",
    "explanation": "If the gun is aimed directly at the moving target, by the time the bullet reaches the target's original position, the target will have moved. You must aim ahead of the target.",
    "tags": ["physics", "kinematics", "master"]
  },
  {
    "question": "The coordinates of a particle are x = a cos(ωt) and y = a sin(ωt). The acceleration vector is:",
    "options": [
      { "id": "A", "text": "-ω² r" },
      { "id": "B", "text": "ω² r" },
      { "id": "C", "text": "ω r" },
      { "id": "D", "text": "0" }
    ],
    "correctAnswerId": "A",
    "explanation": "v_x = -aω sin(ωt), a_x = -aω² cos(ωt) = -ω² x. Similarly a_y = -ω² y. Thus a_vec = -ω² (x i + y j) = -ω² r.",
    "tags": ["physics", "kinematics", "master", "circular-motion"]
  },
  {
    "question": "A shell explodes into two fragments of equal mass. If they move with velocities v1 and v2, the velocity of the center of mass is:",
    "options": [
      { "id": "A", "text": "0" },
      { "id": "B", "text": "(v1+v2)/2" },
      { "id": "C", "text": "v1-v2" },
      { "id": "D", "text": "sqrt(v1²+v2²)" }
    ],
    "correctAnswerId": "B",
    "explanation": "V_cm = (m1 v1 + m2 v2) / (m1+m2). Since m1=m2=m, V_cm = m(v1+v2) / 2m = (v1+v2)/2.",
    "tags": ["physics", "kinematics", "master", "center-of-mass"]
  },
  {
    "question": "A particle moves such that its velocity varies with time as v = t² - t. What is the total distance covered in the interval t=0 to t=2?",
    "options": [
      { "id": "A", "text": "2/3" },
      { "id": "B", "text": "1" },
      { "id": "C", "text": "5/6" },
      { "id": "D", "text": "3/2" }
    ],
    "correctAnswerId": "B",
    "explanation": "Distance is ∫|v|dt. v is negative for 0 < t < 1 and positive for 1 < t < 2. Distance = -∫(0 to 1)(t²-t)dt + ∫(1 to 2)(t²-t)dt. Integral of t²-t is t³/3 - t²/2. From 0 to 1: 1/3 - 1/2 = -1/6. Distance1 = 1/6. From 1 to 2: (8/3 - 2) - (-1/6) = 2/3 + 1/6 = 5/6. Total distance = 1/6 + 5/6 = 1.",
    "tags": ["physics", "kinematics", "master", "calculus"]
  },
  {
    "question": "A rocket is launched vertically. Its velocity v is given by v = u ln(M0/M) - gt. What does M0 represent?",
    "options": [
      { "id": "A", "text": "Final mass" },
      { "id": "B", "text": "Initial mass" },
      { "id": "C", "text": "Mass of fuel" },
      { "id": "D", "text": "Mass of payload" }
    ],
    "correctAnswerId": "B",
    "explanation": "This is the Tsiolkovsky rocket equation. M0 is the initial total mass of the rocket including fuel.",
    "tags": ["physics", "kinematics", "master", "variable-mass"]
  },
  {
    "question": "A car accelerates from rest at a constant rate α for some time, then decelerates at a constant rate β to come to rest. If the total time is T, the maximum velocity attained is:",
    "options": [
      { "id": "A", "text": "αβT / (α+β)" },
      { "id": "B", "text": "αβT / 2(α+β)" },
      { "id": "C", "text": "T / (α+β)" },
      { "id": "D", "text": "(α+β)T / αβ" }
    ],
    "correctAnswerId": "A",
    "explanation": "Let v_max be attained at time t1. v_max = α * t1. The deceleration time is t2. v_max = β * t2. T = t1 + t2 = v_max/α + v_max/β = v_max (α+β) / (αβ). Therefore v_max = αβT / (α+β).",
    "tags": ["physics", "kinematics", "master"]
  }
];

const data = JSON.parse(fs.readFileSync('server/seed.json', 'utf8'));

data.exams.forEach(exam => {
  if (exam.title === "JEE Main") {
    exam.subjects.forEach(sub => {
      if (sub.name === "Physics") {
        sub.topics.forEach(top => {
          if (top.slug === "kinematics") {
            // Remove old levels to ensure only Rookie, Skilled, Expert, Master are there
            top.levels = {
              "Rookie": physicsRookie,
              "Skilled": physicsSkilled,
              "Expert": physicsExpert,
              "Master": physicsMaster
            };
          }
        });
      }
    });
  }
});

fs.writeFileSync('server/seed.json', JSON.stringify(data, null, 2));
console.log("Updated server/seed.json with Rookie, Skilled, Expert, Master levels for Physics > Kinematics.");
