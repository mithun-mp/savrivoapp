import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeErrorMessage, sanitizeMongoUri, sanitizeError } from './sanitize';

describe('Sanitization Utilities', () => {
  describe('mongodb:// credentials masking', () => {
    it('masks password in standard mongodb:// URI with single host', () => {
      const raw = 'mongodb://myuser:mypassword123@localhost:27017/savrivo';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'mongodb://myuser:****@localhost:27017/savrivo');
    });

    it('masks password in mongodb:// URI with multiple replica set hosts', () => {
      const raw = 'mongodb://cluster_admin:SuperSecret999@host1:27017,host2:27017/savrivo?replicaSet=rs0&authSource=admin';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'mongodb://cluster_admin:****@host1:27017,host2:27017/savrivo?replicaSet=rs0&authSource=admin');
    });

    it('masks empty password in mongodb:// URI', () => {
      const raw = 'mongodb://app_user:@localhost:27017/savrivo';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'mongodb://app_user:****@localhost:27017/savrivo');
    });

    it('preserves mongodb:// URI without credentials untouched', () => {
      const raw = 'mongodb://localhost:27017/savrivo';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'mongodb://localhost:27017/savrivo');
    });
  });

  describe('mongodb+srv:// credentials masking', () => {
    it('masks password in MongoDB Atlas SRV URI', () => {
      const raw = 'mongodb+srv://mithunmpmail_db_user:SecretPassword2025@savrivo.qlvie1u.mongodb.net/savrivo?retryWrites=true&w=majority&appName=SAVRIVO';
      const result = sanitizeErrorMessage(raw);
      assert.equal(
        result,
        'mongodb+srv://mithunmpmail_db_user:****@savrivo.qlvie1u.mongodb.net/savrivo?retryWrites=true&w=majority&appName=SAVRIVO'
      );
    });

    it('masks credentials inside complex error messages', () => {
      const raw = 'MongoServerSelectionError: connection <monitor> to savrivo.qlvie1u.mongodb.net:27017 closed; mongodb+srv://db_user:hunter2@savrivo.qlvie1u.mongodb.net/savrivo';
      const result = sanitizeErrorMessage(raw);
      assert.equal(
        result,
        'MongoServerSelectionError: connection <monitor> to savrivo.qlvie1u.mongodb.net:27017 closed; mongodb+srv://db_user:****@savrivo.qlvie1u.mongodb.net/savrivo'
      );
    });
  });

  describe('multiple MongoDB URIs in a single message', () => {
    it('masks all MongoDB URIs embedded within a single error message', () => {
      const raw = 'Sync failure: primary mongodb://primary_user:p1@primary.host:27017/savrivo and secondary mongodb+srv://replica_user:p2@replica.host/savrivo';
      const result = sanitizeErrorMessage(raw);
      assert.equal(
        result,
        'Sync failure: primary mongodb://primary_user:****@primary.host:27017/savrivo and secondary mongodb+srv://replica_user:****@replica.host/savrivo'
      );
    });

    it('masks three mixed MongoDB URIs across multiline logs', () => {
      const raw = [
        'Cluster topology check:',
        '  Primary: mongodb://admin:pass1@host1:27017/db',
        '  Secondary: mongodb://admin:pass2@host2:27017/db',
        '  Atlas fallback: mongodb+srv://atlas_user:atlas_pass@cluster.mongodb.net/db',
      ].join('\n');

      const result = sanitizeErrorMessage(raw);
      const expected = [
        'Cluster topology check:',
        '  Primary: mongodb://admin:****@host1:27017/db',
        '  Secondary: mongodb://admin:****@host2:27017/db',
        '  Atlas fallback: mongodb+srv://atlas_user:****@cluster.mongodb.net/db',
      ].join('\n');

      assert.equal(result, expected);
    });
  });

  describe('passwords containing URL-encoded special characters', () => {
    it('masks password with URL-encoded @ symbol (%40)', () => {
      const raw = 'mongodb+srv://mithunmpmail_db_user:Mithun%402025@savrivo.qlvie1u.mongodb.net/savrivo?retryWrites=true&w=majority';
      const result = sanitizeErrorMessage(raw);
      assert.equal(
        result,
        'mongodb+srv://mithunmpmail_db_user:****@savrivo.qlvie1u.mongodb.net/savrivo?retryWrites=true&w=majority'
      );
    });

    it('masks password with various URL-encoded punctuation (%21, %23, %24, %2F, %3A, %3D, %3F)', () => {
      const raw = 'mongodb://service_account:P%24%24w%3Ard%21%23%2F%3F@internal-db:27017/savrivo';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'mongodb://service_account:****@internal-db:27017/savrivo');
    });

    it('masks password with encoded spaces, plus signs, and percent signs (%20, %2B, %25)', () => {
      const raw = 'mongodb+srv://app_worker:My%20Complex%25Pass%2B1@cluster.net/savrivo';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'mongodb+srv://app_worker:****@cluster.net/savrivo');
    });
  });

  describe('malformed MongoDB URI strings', () => {
    it('masks credentials when URI is truncated right after @ symbol', () => {
      const raw = 'Truncated: mongodb+srv://admin_user:secret123@';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'Truncated: mongodb+srv://admin_user:****@');
    });

    it('does not alter incomplete URI without @ delimiter', () => {
      const raw = 'Incomplete URI: mongodb://admin:pass';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });

    it('does not alter invalid scheme typo (e.g. mongo://)', () => {
      const raw = 'Typo scheme: mongo://user:pass@host/db';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });

    it('does not alter scheme with missing leading slash (mongodb:/)', () => {
      const raw = 'Malformed scheme: mongodb:/user:pass@host/db';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });

    it('masks credentials when password contains unencoded internal colons', () => {
      const raw = 'mongodb://user:pass:word:123@host:27017/db';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, 'mongodb://user:****@host:27017/db');
    });
  });

  describe('non-MongoDB URLs remain unchanged', () => {
    it('does not alter HTTP or HTTPS URLs with or without user credentials', () => {
      const raw = 'Webhook error: https://api_key:secret_token@partner.api.com/v1/notify';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });

    it('does not alter PostgreSQL, MySQL, or Redis connection strings', () => {
      const raw = 'Migration error: postgres://pguser:pgpass@localhost:5432/savrivo_db';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });

    it('does not alter Redis connection string with secret password', () => {
      const raw = 'Cache error: redis://:redis_secret_pass@127.0.0.1:6379/0';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });
  });

  describe('errors without connection strings', () => {
    it('preserves validation error messages untouched', () => {
      const raw = "ValidationError: Product title: Path 'title' is required.";
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });

    it('preserves network timeout errors without credentials', () => {
      const raw = 'MongoNetworkTimeoutError: connection timed out after 30000ms at 192.168.1.100:27017';
      const result = sanitizeErrorMessage(raw);
      assert.equal(result, raw);
    });

    it('safely handles empty string, null, or undefined', () => {
      assert.equal(sanitizeErrorMessage(''), '');
      assert.equal(sanitizeErrorMessage(null as unknown as string), '');
      assert.equal(sanitizeErrorMessage(undefined as unknown as string), '');
    });
  });

  describe('sanitizeMongoUri', () => {
    it('returns [NOT_SET] for falsy or empty values', () => {
      assert.equal(sanitizeMongoUri(''), '[NOT_SET]');
      assert.equal(sanitizeMongoUri(null), '[NOT_SET]');
      assert.equal(sanitizeMongoUri(undefined), '[NOT_SET]');
    });

    it('masks credentials in valid URI', () => {
      const uri = 'mongodb+srv://admin:pass%21@savrivo.net/savrivo';
      assert.equal(sanitizeMongoUri(uri), 'mongodb+srv://admin:****@savrivo.net/savrivo');
    });
  });

  describe('sanitizeError non-destructive behavior and error preservation', () => {
    class CustomDatabaseError extends Error {
      public code: number;
      public status: number;
      constructor(message: string, code: number, status: number) {
        super(message);
        this.name = 'CustomDatabaseError';
        this.code = code;
        this.status = status;
      }

      public getErrorCode(): string {
        return `DB_ERR_${this.code}`;
      }
    }

    class SpecificMongoError extends CustomDatabaseError {
      public readonly service = 'savrivo-database';
      constructor(message: string) {
        super(message, 11000, 500);
        this.name = 'SpecificMongoError';
      }
    }

    it('returns a new sanitized error object without mutating the original error', () => {
      const originalMessage = 'Failed to connect: mongodb+srv://app_user:SecretPass123@cluster.net/db';
      const originalError = new CustomDatabaseError(originalMessage, 11000, 500);
      const originalStack = originalError.stack;

      const sanitized = sanitizeError(originalError);

      // Verify the original error is NOT mutated
      assert.notEqual(sanitized, originalError);
      assert.equal(originalError.message, originalMessage);
      assert.equal(originalError.stack, originalStack);
      assert.ok(originalError.message.includes('SecretPass123'));

      // Verify identity and prototype preservation on sanitized object
      assert.ok(sanitized instanceof CustomDatabaseError);
      assert.ok(sanitized instanceof Error);
      assert.equal(sanitized.name, 'CustomDatabaseError');
      assert.equal(sanitized.code, 11000);
      assert.equal(sanitized.status, 500);
      assert.equal(sanitized.getErrorCode(), 'DB_ERR_11000');

      // Verify message and stack trace are sanitized
      assert.equal(sanitized.message, 'Failed to connect: mongodb+srv://app_user:****@cluster.net/db');
      assert.ok(!sanitized.message.includes('SecretPass123'));
      if (sanitized.stack) {
        assert.ok(!sanitized.stack.includes('SecretPass123'));
        assert.ok(sanitized.stack.includes('mongodb+srv://app_user:****@cluster.net/db'));
      }
    });

    it('preserves multi-level subclass hierarchy and methods', () => {
      const raw = 'Write error: mongodb://writer:wPass1@host/db';
      const error = new SpecificMongoError(raw);
      const sanitized = sanitizeError(error);

      assert.notEqual(sanitized, error);
      assert.ok(sanitized instanceof SpecificMongoError);
      assert.ok(sanitized instanceof CustomDatabaseError);
      assert.ok(sanitized instanceof Error);
      assert.equal(sanitized.name, 'SpecificMongoError');
      assert.equal(sanitized.service, 'savrivo-database');
      assert.equal(sanitized.getErrorCode(), 'DB_ERR_11000');
      assert.equal(sanitized.message, 'Write error: mongodb://writer:****@host/db');
      assert.equal(error.message, raw);
    });

    it('sanitizes nested error cause without mutating original cause', () => {
      const originalCauseMessage = 'Socket closed: mongodb://raw_user:NestedPass%40123@host:27017/db';
      const originalCause = new Error(originalCauseMessage);
      const originalError = new Error('Connection failed', { cause: originalCause });

      const sanitized = sanitizeError(originalError);

      // Original cause must remain untouched
      assert.equal(originalCause.message, originalCauseMessage);
      assert.ok(originalCause.message.includes('NestedPass%40123'));

      // Sanitized error has sanitized cause
      assert.equal(sanitized.message, 'Connection failed');
      const sanitizedCause = sanitized.cause as Error;
      assert.ok(sanitizedCause instanceof Error);
      assert.notEqual(sanitizedCause, originalCause);
      assert.equal(sanitizedCause.message, 'Socket closed: mongodb://raw_user:****@host:27017/db');
      assert.ok(!sanitizedCause.message.includes('NestedPass%40123'));
    });

    it('handles string errors and plain error objects cleanly', () => {
      const strError = 'Error: connection to mongodb://user:pass@host:27017 failed';
      const sanitizedStr = sanitizeError(strError);
      assert.equal(sanitizedStr, 'Error: connection to mongodb://user:****@host:27017 failed');

      const objError = { message: 'Failed: mongodb+srv://u:p@atlas.net/db', code: 500 };
      const sanitizedObj = sanitizeError(objError);
      assert.notEqual(sanitizedObj, objError);
      assert.equal(sanitizedObj.message, 'Failed: mongodb+srv://u:****@atlas.net/db');
      assert.equal(sanitizedObj.code, 500);
      assert.equal(objError.message, 'Failed: mongodb+srv://u:p@atlas.net/db');
    });
  });
});
