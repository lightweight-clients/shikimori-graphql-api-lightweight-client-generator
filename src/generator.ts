import { GraphQLSpecification } from './types';
import * as config from './config.json';
import * as fs from 'node:fs';
import * as operationId from 'node:path';
import assert from 'node:assert';
import { Eta } from 'eta';
import {
  buildClientSchema,
  DocumentNode,
  IntrospectionObjectType,
  IntrospectionOutputTypeRef,
} from 'graphql';
import * as typescriptPlugin from '@graphql-codegen/typescript';
import { codegen } from '@graphql-codegen/core';
import { Types } from '@graphql-codegen/plugin-helpers';

type EndpointRenderData = {
  queryName: string;
  upperQueryName: string;
  hasArgs: boolean;
  returnType: string;
  baseReturnType: string;
};

type RenderData =
  | {
      endpoints: EndpointRenderData[];
    }
  | {
      rawText: string;
    };

const fetchSpecification = async (): Promise<GraphQLSpecification> => {
  console.log('Fetching specification...');

  const specRes = await fetch(config.specification_url);
  const spec = await specRes.json();
  assert(spec && typeof spec === 'object');

  return spec;
};

const GetReturnType = (type: IntrospectionOutputTypeRef): string => {
  if (type.kind === 'NON_NULL') {
    return GetReturnType(type.ofType);
  } else if (type.kind === 'LIST') {
    return `${GetReturnType(type.ofType)}[]`;
  } else if (type.kind === 'SCALAR' || type.kind === 'ENUM') {
    return type.name;
  } else if (type.kind === 'OBJECT') {
    return type.name;
  } else {
    throw new Error(`Unsupported type kind: ${type.kind}`);
  }
};

const getClientRenderData = (spec: GraphQLSpecification): RenderData => {
  const queries = spec.data.__schema.types.filter(
    (type) => type.kind === 'OBJECT' && type.name === 'Query',
  );
  assert(queries.length === 1, 'Expected exactly one Query type in the schema');
  assert(
    (queries[0] as IntrospectionObjectType).fields,
    'Query type should have fields',
  );

  const endpoints: EndpointRenderData[] = [];
  for (const query of (queries[0] as IntrospectionObjectType).fields) {
    const returnType = GetReturnType(query.type);

    const endpoint: EndpointRenderData = {
      queryName: query.name,
      upperQueryName: query.name.charAt(0).toUpperCase() + query.name.slice(1),
      hasArgs: query.args.length > 0,
      returnType: returnType,
      baseReturnType: returnType.endsWith('[]')
        ? returnType.slice(0, -2)
        : returnType,
    };
    endpoints.push(endpoint);
  }
  return { endpoints };
};

const generateEtaFile = async (
  fileName: string,
  data: RenderData | object,
): Promise<void> => {
  console.log(`Generating ${fileName}.eta...`);

  const eta = new Eta({ views: operationId.resolve(__dirname, 'templates') });
  const content = await eta.renderAsync(`${fileName}.eta`, data);
  await fs.promises.writeFile(
    `${config.output_folder}/${fileName}.ts`,
    content,
    'utf-8',
  );
};

const getTypesRenderData = async (
  spec: GraphQLSpecification,
): Promise<RenderData> => {
  const config: Types.GenerateOptions = {
    schemaAst: buildClientSchema(spec.data),
    plugins: [
      {
        typescript: {},
      },
    ],
    pluginMap: {
      typescript: typescriptPlugin,
    },

    // these fields are not used but required by the codegen API
    filename: null as unknown as string,
    schema: null as unknown as DocumentNode,
    documents: [],
    config: {},
  };

  console.log('Generating types...');
  const types = await codegen(config);
  console.log('Types generated successfully');
  return { rawText: types };
};

export const generate = async () => {
  const spec = await fetchSpecification();

  const renderData = getClientRenderData(spec);

  fs.mkdirSync(config.output_folder, { recursive: true });

  await generateEtaFile('core', {});
  await generateEtaFile('index', {});
  await generateEtaFile('client', renderData);
  await generateEtaFile('types-client', {});
  await generateEtaFile('types-api', await getTypesRenderData(spec));
};

generate()
  .then(() => {
    console.log('Done');
  })
  .catch((e) => {
    console.error(e);
  });
