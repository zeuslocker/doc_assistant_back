import { arg, makeSchema, stringArg, nonNull, queryField, scalarType } from 'nexus'
import 'dotenv/config'
import OpenAI from "openai"
const assistantId: any = process.env.OPENAI_ASSISTANT_ID

const openai = new OpenAI({
  organization: process.env.OPENAI_ORGANIZATION,
  apiKey: process.env.OAI_API_KEY
});

const FileScalar = scalarType({
  name: 'File',
  asNexusMethod: 'file',
  description: 'The `File` scalar type represents a file upload.',
  sourceType: 'File'
})

const getDiagnose = queryField('getDiagnose', {
  type: 'String',
  args: { symptoms: nonNull(stringArg()), medicalCard: arg({ type: 'File' }), medicalTests: arg({ type: 'File' }) },
  resolve: async (parent, { symptoms, medicalCard, medicalTests }, ctx) => {
    debugger
    try {
    let threadMessages: any = []

    if (medicalCard) {
      const file = await openai.files.create({
        file: medicalCard,
        purpose: "assistants"
      });
      threadMessages.push({ role: 'user', content: 'Medical test results', file_ids: [file.id], metadata: {} })
    }
    if (medicalTests) {
      const file = await openai.files.create({
        file: medicalTests,
        purpose: "assistants"
      });
      threadMessages.push({ role: 'user', content: 'Medical record', file_ids: [file.id], metadata: {} })
    }

    const thread = await openai.beta.threads.create(
      {
        messages: threadMessages,
        metadata: {},
      }
    )

    const message = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: symptoms,
    });

    const run_base = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    while (true) {
      const run = await openai.beta.threads.runs.retrieve(thread.id, run_base.id);
      if (run.status === "completed") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const messages: any = await openai.beta.threads.messages.list(thread.id);
    return messages.body.data[0].content[0].text.value
  } catch(error) {
      console.log('ERROR--------------\n')
      console.log(error)
      return 'Sorry we have an internal error, please try to use system later'
  }
  }
})

export const schema = makeSchema({
  types: [FileScalar, getDiagnose],
  outputs: {
    schema: __dirname + '/generated/schema.graphql',
    typegen: __dirname + '/generated/typings.ts',
  },
});
