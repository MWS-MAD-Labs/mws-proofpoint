import assert from "node:assert/strict";
import test from "node:test";
import {
  applyKpiPreviewUpdate,
  buildKpiPreviewDomains,
  buildObservationPreviewTemplate,
} from "./rubric-preview-utils";

test("buildKpiPreviewDomains normalizes blank names and preserves existing trial responses", () => {
  const domains = buildKpiPreviewDomains(
    {
      name: "Teacher Appraisal",
      domains: [
        {
          id: "d-1",
          name: "   ",
          weight: 40,
          standards: [
            {
              id: "s-1",
              name: "",
              kpis: [
                {
                  id: "k-1",
                  name: "  ",
                  description: "Desc",
                  evidence_guidance: "Guide",
                  trainings: "Training A",
                  rubric_4: "R4",
                  rubric_3: "R3",
                  rubric_2: "R2",
                  rubric_1: "R1",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      "k-1": {
        score: 4,
        evidence: [{ id: "1", title: "Doc", evidence: "https://example.com" }],
      },
    },
  );

  assert.equal(domains.length, 1);
  assert.equal(domains[0].name, "Untitled Domain");
  assert.equal(domains[0].standards[0].name, "Untitled Standard");
  assert.equal(domains[0].standards[0].kpis[0].name, "Untitled KPI");
  assert.equal(domains[0].standards[0].kpis[0].score, 4);
});

test("applyKpiPreviewUpdate updates only the targeted KPI score and evidence", () => {
  const initial = buildKpiPreviewDomains({
    domains: [
      {
        id: "d-1",
        name: "Domain 1",
        weight: 100,
        standards: [
          {
            id: "s-1",
            name: "Standard 1",
            kpis: [
              {
                id: "k-1",
                name: "KPI 1",
                rubric_4: "4",
                rubric_3: "3",
                rubric_2: "2",
                rubric_1: "1",
              },
              {
                id: "k-2",
                name: "KPI 2",
                rubric_4: "4",
                rubric_3: "3",
                rubric_2: "2",
                rubric_1: "1",
              },
            ],
          },
        ],
      },
    ],
  });

  const updated = applyKpiPreviewUpdate(initial, "k-2", { score: 3 });
  assert.equal(updated[0].standards[0].kpis[0].score, null);
  assert.equal(updated[0].standards[0].kpis[1].score, 3);
});

test("buildObservationPreviewTemplate merges in-flight template, section, and indicator edits including pending newOption", () => {
  const preview = buildObservationPreviewTemplate({
    selected: {
      id: "obs-1",
      name: "Original Form",
      description: "Original Desc",
      sections: [
        {
          id: "sec-1",
          name: "Original Section",
          indicators: [
            {
              id: "ind-1",
              name: "Original Indicator",
              description: "Old desc",
              evidence_guidance: "Old guide",
              question_type: "SCALE",
              score_options: null,
              is_required: true,
            },
          ],
        },
      ],
    },
    editingTemplateInfo: true,
    editName: "Updated Form Name",
    editDescription: "Updated Form Desc",
    editingSectionId: "sec-1",
    editingSectionName: "Updated Section Name",
    editingIndicator: {
      id: "ind-1",
      name: "Updated Indicator",
      description: "New desc",
      evidence_guidance: "New guide",
      question_type: "CHOICE",
      score_options: ["Yes", "Partially"],
      is_required: false,
      newOption: "No",
    },
  });

  assert.ok(preview);
  assert.equal(preview.name, "Updated Form Name");
  assert.equal(preview.description, "Updated Form Desc");
  assert.equal(preview.sections[0].name, "Updated Section Name");
  assert.equal(preview.sections[0].indicators[0].name, "Updated Indicator");
  assert.equal(preview.sections[0].indicators[0].questionType, "CHOICE");
  assert.equal(preview.sections[0].indicators[0].isRequired, false);
  assert.deepEqual(preview.sections[0].indicators[0].scoreOptions, [
    "Yes",
    "Partially",
    "No",
  ]);
});

test("buildObservationPreviewTemplate strips scoreOptions when questionType is not CHOICE and deduplicates pending newOption", () => {
  const scalePreview = buildObservationPreviewTemplate({
    selected: {
      id: "obs-2",
      name: "   ",
      sections: [
        {
          id: "sec-1",
          name: "   ",
          indicators: [
            {
              id: "ind-1",
              name: "   ",
              question_type: "CHOICE",
              score_options: ["A", "B"],
            },
          ],
        },
      ],
    },
    editingIndicator: {
      id: "ind-1",
      name: "  ",
      description: "",
      evidence_guidance: "",
      question_type: "SCALE",
      score_options: ["A", "B"],
      is_required: true,
      newOption: "C",
    },
  });

  assert.ok(scalePreview);
  assert.equal(scalePreview.name, "Untitled Observation Form");
  assert.equal(scalePreview.sections[0].name, "Untitled Section");
  assert.equal(scalePreview.sections[0].indicators[0].name, "Untitled Indicator");
  assert.equal(scalePreview.sections[0].indicators[0].questionType, "SCALE");
  assert.deepEqual(scalePreview.sections[0].indicators[0].scoreOptions, []);

  const dedupedChoice = buildObservationPreviewTemplate({
    selected: {
      id: "obs-3",
      name: "Choice Form",
      sections: [
        {
          id: "sec-1",
          name: "Section 1",
          indicators: [
            {
              id: "ind-1",
              name: "Q1",
              question_type: "CHOICE",
              score_options: ["Yes", "No"],
            },
          ],
        },
      ],
    },
    editingIndicator: {
      id: "ind-1",
      name: "Q1",
      description: "",
      evidence_guidance: "",
      question_type: "CHOICE",
      score_options: ["Yes", "No"],
      is_required: true,
      newOption: "Yes",
    },
  });

  assert.ok(dedupedChoice);
  assert.deepEqual(dedupedChoice.sections[0].indicators[0].scoreOptions, [
    "Yes",
    "No",
  ]);
});

