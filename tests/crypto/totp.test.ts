import { describe, it, expect } from 'vitest';
import { generateTotp, base32ToBytes, parseOtpAuthUri } from '../../src/crypto/totp';

describe('TOTP (RFC 6238) Engine', () => {
  // Secret: "12345678901234567890" in Base32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('correctly converts Base32 strings into bytes', () => {
    const bytes = base32ToBytes('JBSWY3DPEHPK3PXP');
    expect(bytes.length).toBe(10);
  });

  it('generates correct RFC 6238 SHA-1 test vectors', () => {
    // T = 59s -> timeStep = 1 -> code: '287082' (6 digits)
    const result1 = generateTotp({
      secret: RFC_SECRET_BASE32,
      algorithm: 'SHA-1',
      digits: 6,
      periodSeconds: 30,
      timestamp: 59 * 1000,
    });
    expect(result1.code).toBe('287082');

    // T = 1111111109s -> timeStep = 37037036 -> code: '081804'
    const result2 = generateTotp({
      secret: RFC_SECRET_BASE32,
      algorithm: 'SHA-1',
      digits: 6,
      periodSeconds: 30,
      timestamp: 1111111109 * 1000,
    });
    expect(result2.code).toBe('081804');
  });

  it('generates 8-digit codes when requested', () => {
    const result = generateTotp({
      secret: RFC_SECRET_BASE32,
      algorithm: 'SHA-1',
      digits: 8,
      periodSeconds: 30,
      timestamp: 59 * 1000,
    });
    expect(result.code.length).toBe(8);
    expect(result.code).toBe('94287082');
  });

  it('calculates remaining seconds and percentage correctly', () => {
    const result = generateTotp({
      secret: RFC_SECRET_BASE32,
      periodSeconds: 30,
      timestamp: 10 * 1000, // 10s into 30s period -> 20s remaining
    });
    expect(result.secondsRemaining).toBe(20);
    expect(result.progressPercent).toBe(67);
  });

  it('parses standard otpauth:// URIs accurately', () => {
    const uri = 'otpauth://totp/GitHub:developer@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30&algorithm=SHA1';
    const parsed = parseOtpAuthUri(uri);

    expect(parsed.type).toBe('totp');
    expect(parsed.issuer).toBe('GitHub');
    expect(parsed.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
    expect(parsed.algorithm).toBe('SHA-1');
  });
});
