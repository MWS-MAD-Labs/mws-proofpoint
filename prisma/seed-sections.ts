// prisma/seed-sections.ts
// Standalone: npx tsx prisma/seed-sections.ts
// Via seed.ts: import { seedSections } from "./seed-sections.js"

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const rubricData: Record<
  string,
  { sections: { name: string; weight: number; indicators: { name: string; description: string }[] }[] }
> = {
  "DETAILED CLASSROOM OBSERVATION": {
    sections: [
      { name: "Classroom Environment", weight: 20, indicators: [
        { name: "Classroom Setup",               description: "Classroom layout supports effective learning" },
        { name: "Learning Objectives Displayed", description: "Learning objectives are posted and visible to students" },
        { name: "Resources Available",           description: "Teaching materials and learning resources are available and accessible" },
      ]},
      { name: "Lesson Delivery", weight: 40, indicators: [
        { name: "Clear Explanation",   description: "Teacher explains content clearly and in a structured manner" },
        { name: "Appropriate Pacing",  description: "Teaching pace is appropriate for student ability" },
        { name: "Use of Examples",     description: "Teacher uses relevant and concrete examples" },
        { name: "Student Questioning", description: "Teacher encourages students to ask questions and think critically" },
      ]},
      { name: "Student Engagement", weight: 25, indicators: [
        { name: "Active Participation",        description: "Students actively participate in learning activities" },
        { name: "On-task Behavior",            description: "Students remain focused and complete assigned tasks" },
        { name: "Student-Teacher Interaction", description: "Positive student-teacher interaction is maintained" },
      ]},
      { name: "Assessment & Feedback", weight: 15, indicators: [
        { name: "Formative Assessment", description: "Teacher conducts formative assessment during learning" },
        { name: "Feedback Quality",     description: "Teacher provides constructive feedback to students" },
      ]},
    ],
  },
  "CHECKLIST FOR DIRECT INSTRUCTION": {
    sections: [
      { name: "Preparation", weight: 25, indicators: [
        { name: "Lesson Plan Ready",  description: "Lesson plan has been prepared before the class" },
        { name: "Materials Prepared", description: "Teaching materials and media are ready" },
      ]},
      { name: "Instruction Delivery", weight: 50, indicators: [
        { name: "Opening / Set Induction", description: "Teacher opens the lesson effectively (review, motivation)" },
        { name: "Modelling",               description: "Teacher demonstrates concepts or skills clearly" },
        { name: "Guided Practice",         description: "Teacher guides students through practice together" },
        { name: "Independent Practice",    description: "Students are given opportunities to practice independently" },
        { name: "Closure",                 description: "Teacher closes the lesson with a summary and reflection" },
      ]},
      { name: "Classroom Management", weight: 25, indicators: [
        { name: "Time Management",     description: "Lesson time is managed efficiently" },
        { name: "Behavior Management", description: "Student behavior is managed effectively" },
      ]},
    ],
  },
  "Special Education Teacher Supervision Instrument": {
    sections: [
      { name: "Individualized Support", weight: 35, indicators: [
        { name: "IEP Implementation",        description: "Individual Education Program (IEP) is implemented correctly" },
        { name: "Adaptive Materials",        description: "Adaptive materials are used according to student needs" },
        { name: "Individualized Strategies", description: "Individual strategies are applied for each student with special needs" },
      ]},
      { name: "Inclusive Practices", weight: 35, indicators: [
        { name: "Accommodation Provided", description: "Appropriate accommodations are provided to students" },
        { name: "Positive Environment",   description: "A positive and inclusive learning environment is created" },
        { name: "Peer Interaction",       description: "Positive peer interaction is facilitated" },
      ]},
      { name: "Communication & Collaboration", weight: 30, indicators: [
        { name: "Parent Communication", description: "Communication with parents is conducted regularly" },
        { name: "Team Collaboration",   description: "Collaboration with the education team runs smoothly" },
      ]},
    ],
  },
  "CHECKLIST FOR LEARNING AND UNDERSTANDING": {
    sections: [
      { name: "Knowledge Building", weight: 40, indicators: [
        { name: "Prior Knowledge Activation", description: "Students' prior knowledge is activated before new content" },
        { name: "Concept Explanation",        description: "Concepts are explained in an easy-to-understand way" },
        { name: "Examples & Non-examples",    description: "Examples and non-examples are used to clarify concepts" },
      ]},
      { name: "Comprehension Check", weight: 35, indicators: [
        { name: "Checking for Understanding", description: "Teacher periodically checks student understanding" },
        { name: "Questioning Techniques",     description: "Effective questioning techniques are used" },
        { name: "Student Responses",          description: "Student responses are monitored and followed up" },
      ]},
      { name: "Application", weight: 25, indicators: [
        { name: "Practical Application", description: "Students are given opportunities to apply learned concepts" },
        { name: "Problem Solving",        description: "Students are trained to solve problems using new concepts" },
      ]},
    ],
  },
  "FOCUS ON LEARNERS – STUDENT ENGAGEMENT": {
    sections: [
      { name: "Active Learning", weight: 50, indicators: [
        { name: "Student Participation Rate", description: "Percentage of students actively participating in learning" },
        { name: "Hands-on Activities",        description: "Hands-on activities are provided to increase engagement" },
        { name: "Discussion Facilitation",    description: "Class discussion is well facilitated by the teacher" },
        { name: "Student Voice",              description: "Students are given opportunities to express their opinions" },
      ]},
      { name: "Motivation & Interest", weight: 30, indicators: [
        { name: "Relevance to Real Life", description: "Content is connected to students' real-life experiences" },
        { name: "Student Choice",         description: "Students are given choices in the learning process" },
        { name: "Positive Reinforcement", description: "Positive reinforcement is provided consistently" },
      ]},
      { name: "On-task Behavior", weight: 20, indicators: [
        { name: "Focus & Attention", description: "Students remain focused throughout the lesson" },
        { name: "Task Completion",   description: "Students complete assigned tasks on time" },
      ]},
    ],
  },
  "CHECKLIST FOR DIFFERENTIATION": {
    sections: [
      { name: "Content Differentiation", weight: 35, indicators: [
        { name: "Tiered Materials",         description: "Materials are differentiated based on student ability levels" },
        { name: "Multiple Representations", description: "Concepts are presented in multiple representations" },
        { name: "Varied Complexity",        description: "Task complexity levels are adjusted accordingly" },
      ]},
      { name: "Process Differentiation", weight: 35, indicators: [
        { name: "Flexible Grouping",    description: "Flexible grouping is applied according to student needs" },
        { name: "Learning Stations",    description: "Learning stations are used to accommodate different learning styles" },
        { name: "Scaffolding Provided", description: "Scaffolding is provided to students who need it" },
      ]},
      { name: "Product Differentiation", weight: 30, indicators: [
        { name: "Varied Assessment Options", description: "Diverse assessment options are offered to students" },
        { name: "Student Choice in Output",  description: "Students can choose how to demonstrate their understanding" },
      ]},
    ],
  },
  "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING": {
    sections: [
      { name: "Group Structure", weight: 30, indicators: [
        { name: "Purposeful Grouping", description: "Grouping is done with a clear purpose" },
        { name: "Clear Roles",         description: "Each group member's role is clearly defined" },
        { name: "Group Size",          description: "Group size is appropriate for the activity" },
      ]},
      { name: "Collaboration Quality", weight: 40, indicators: [
        { name: "Peer Interaction",      description: "Student interaction within the group is productive" },
        { name: "Accountable Talk",      description: "Students use academic language in group discussions" },
        { name: "Conflict Resolution",   description: "Disagreements are resolved in a positive manner" },
        { name: "Shared Responsibility", description: "Responsibility is shared equally within the group" },
      ]},
      { name: "Teacher Support", weight: 30, indicators: [
        { name: "Monitoring Groups",     description: "Teacher monitors the progress of each group" },
        { name: "Targeted Intervention", description: "Teacher provides targeted assistance where needed" },
      ]},
    ],
  },
  "CLASSROOM DISPLAY CHECKLIST": {
    sections: [
      { name: "Learning Environment", weight: 40, indicators: [
        { name: "Learning Objectives Posted",     description: "Learning objectives are posted and clearly visible" },
        { name: "Word Wall / Vocabulary Display", description: "Key vocabulary is displayed in the classroom" },
        { name: "Student Work Displayed",         description: "Student work samples are displayed in the classroom" },
        { name: "Classroom Rules Posted",         description: "Classroom rules are posted and easy to read" },
      ]},
      { name: "Organization & Aesthetics", weight: 35, indicators: [
        { name: "Cleanliness & Order",  description: "Classroom is clean and well-organized" },
        { name: "Displays are Current", description: "Classroom displays are relevant to current learning content" },
        { name: "Accessible Resources", description: "Learning resources are easily accessible to students" },
      ]},
      { name: "Safety & Comfort", weight: 25, indicators: [
        { name: "Adequate Lighting",       description: "Room lighting is adequate for learning" },
        { name: "Comfortable Temperature", description: "Room temperature is comfortable for learning" },
        { name: "Safe Movement Space",     description: "Safe movement space is available for students" },
      ]},
    ],
  },
  "Test Observation": {
    sections: [
      { name: "Test Section", weight: 100, indicators: [
        { name: "Test Indicator 1", description: "First indicator for testing purposes" },
        { name: "Test Indicator 2", description: "Second indicator for testing purposes" },
      ]},
    ],
  },
  "Lesson Preparation Walkthrough": {
    sections: [
      { name: "Planning Documents", weight: 40, indicators: [
        { name: "Lesson Plan Quality",         description: "Quality of the lesson plan prepared by the teacher" },
        { name: "Alignment to Curriculum",     description: "Alignment with the current curriculum" },
        { name: "Learning Objectives Clarity", description: "Clarity of the learning objectives formulated" },
      ]},
      { name: "Resources & Materials", weight: 35, indicators: [
        { name: "Materials Prepared",     description: "Teaching materials have been prepared before the lesson" },
        { name: "Technology Integration", description: "Technology is integrated in learning where appropriate" },
        { name: "Assessment Tools Ready", description: "Assessment instruments have been prepared" },
      ]},
      { name: "Teacher Readiness", weight: 25, indicators: [
        { name: "Content Mastery",            description: "Teacher has mastered the content to be taught" },
        { name: "Anticipation of Challenges", description: "Teacher anticipates potential challenges in advance" },
      ]},
    ],
  },
  "DELIVERY OF INSTRUCTION": {
    sections: [
      { name: "Opening", weight: 15, indicators: [
        { name: "Attention Getter",             description: "Teacher opens the lesson in a way that captures student attention" },
        { name: "Connection to Prior Learning", description: "Content is connected to previous lessons" },
      ]},
      { name: "Instruction", weight: 50, indicators: [
        { name: "Clarity of Instruction",    description: "Instructions are delivered clearly and easy to understand" },
        { name: "Use of Visual Aids",         description: "Visual aids are used effectively" },
        { name: "Student Interaction",        description: "Student interaction is maintained throughout the lesson" },
        { name: "Differentiated Instruction", description: "Instruction is differentiated to meet student needs" },
        { name: "Higher Order Thinking",      description: "Higher order thinking (HOTS) questions are used" },
      ]},
      { name: "Practice & Application", weight: 25, indicators: [
        { name: "Guided Practice",      description: "Guided practice is provided after instruction" },
        { name: "Independent Practice", description: "Independent practice is given to measure understanding" },
      ]},
      { name: "Closing", weight: 10, indicators: [
        { name: "Summary / Recap",        description: "Teacher summarizes the lesson content" },
        { name: "Preview of Next Lesson", description: "Teacher provides a preview of the next lesson" },
      ]},
    ],
  },
  "obstest": {
    sections: [
      { name: "Test Section A", weight: 50, indicators: [
        { name: "Indicator A1", description: "First test indicator" },
        { name: "Indicator A2", description: "Second test indicator" },
      ]},
      { name: "Test Section B", weight: 50, indicators: [
        { name: "Indicator B1", description: "Third test indicator" },
        { name: "Indicator B2", description: "Fourth test indicator" },
      ]},
    ],
  },
  "obsertvertest": {
    sections: [
      { name: "Observer Test Section", weight: 100, indicators: [
        { name: "Observer Indicator 1", description: "First observer test indicator" },
        { name: "Observer Indicator 2", description: "Second observer test indicator" },
      ]},
    ],
  },
};

export async function seedSections(prisma: PrismaClient): Promise<void> {
  console.log("\n📐 [seed-sections] Seeding sections & indicators...\n");

  let successCount = 0;
  let skipCount    = 0;
  let errorCount   = 0;

  for (const [rubricName, data] of Object.entries(rubricData)) {
    try {
      const rubric = await prisma.rubricTemplate.findFirst({
        where:   { name: rubricName },
        include: { sections: true },
      });

      if (!rubric) {
        console.log(`⚠️  Rubric not found: "${rubricName}" — skipping`);
        skipCount++;
        continue;
      }

      if (rubric.sections.length > 0) {
        await prisma.rubricSection.deleteMany({ where: { templateId: rubric.id } });
        console.log(`🗑️  Removed ${rubric.sections.length} old section(s) from "${rubricName}"`);
      }

      let sortOrder = 0;
      for (const sectionData of data.sections) {
        sortOrder++;
        const section = await prisma.rubricSection.create({
          data: {
            id:         crypto.randomUUID(),
            templateId: rubric.id,
            name:       sectionData.name,
            weight:     sectionData.weight,
            sortOrder,
          },
        });

        let indOrder = 0;
        for (const ind of sectionData.indicators) {
          indOrder++;
          await prisma.rubricIndicator.create({
            data: {
              id:          crypto.randomUUID(),
              sectionId:   section.id,
              name:        ind.name,
              description: ind.description,
              sortOrder:   indOrder,
            },
          });
        }

        console.log(`  ✅ Section "${sectionData.name}" (${sectionData.indicators.length} indicators)`);
      }

      console.log(`✅ "${rubricName}" — ${data.sections.length} section(s) done\n`);
      successCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error for rubric "${rubricName}":`, message);
      errorCount++;
    }
  }

  const totalSections   = await prisma.rubricSection.count();
  const totalIndicators = await prisma.rubricIndicator.count();
  console.log(`🎉 [seed-sections] Done!`);
  console.log(`   ✅ Rubrics succeeded : ${successCount}`);
  console.log(`   ⚠️  Skipped           : ${skipCount}`);
  console.log(`   ❌ Errors             : ${errorCount}`);
  console.log(`   Total sections       : ${totalSections}`);
  console.log(`   Total indicators     : ${totalIndicators}\n`);
}

// ── Standalone runner ──
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const prisma = createPrismaClient();
  seedSections(prisma)
    .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}