// Google's signed POST policies support both bucket-hosted and path-style URLs:
// https://docs.cloud.google.com/storage/docs/xml-api/post-object-forms
// Keep every signed form field intact; this does not apply to query-signed URLs.
const { Buffer } = require('node:buffer');
const uploads = require('eas-cli/build/uploads');

const upload = uploads.uploadWithPresignedPostWithRetryAsync;
const bucket = 'update-assets-upload-production';

uploads.uploadWithPresignedPostWithRetryAsync = (file, specification, onBegin) => {
  const url = new URL(specification.url);
  if (url.hostname !== `${bucket}.storage.googleapis.com` || url.pathname !== '/' || url.search) {
    return upload(file, specification, onBegin);
  }

  const policy = JSON.parse(Buffer.from(specification.fields.policy, 'base64').toString('utf8'));
  const conditions = policy.conditions ?? [];
  const hasExpectedBucket = conditions.some(condition => condition.bucket === bucket
    || (Array.isArray(condition) && condition[0] === 'eq' && condition[1] === '$bucket' && condition[2] === bucket));
  const hasHostCondition = conditions.some(condition => Object.hasOwn(condition, 'host')
    || (Array.isArray(condition) && condition.includes('$host')));
  if (!hasExpectedBucket || hasHostCondition) {
    throw new Error('Unexpected GCS upload policy; refusing to change its endpoint.');
  }

  return upload(file, {
    ...specification,
    url: `https://storage.googleapis.com/${bucket}/`,
  }, onBegin);
};
