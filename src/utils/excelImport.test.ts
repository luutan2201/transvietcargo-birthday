import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseCustomerFile } from './excelImport';

function csvFile(content: string): File {
  return new File(['\uFEFF' + content], 'test.csv', { type: 'text/csv' });
}

function xlsxFile(rows: unknown[][]): File {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true });
  return new File([buf], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('parseCustomerFile — gender formats', () => {
  it('recognizes M/F, Nam/Nữ, and Male/Female formats', async () => {
    const csv = [
      'Full Name,Email,Gender',
      'Nguyen Van A,a@test.com,M',
      'Tran Thi B,b@test.com,F',
      'Le Van C,c@test.com,Nam',
      'Pham Thi D,d@test.com,Nữ',
      'John Smith,e@test.com,Male',
      'Jane Doe,f@test.com,Female',
    ].join('\n');

    const result = await parseCustomerFile(csvFile(csv));
    expect(result.errors).toHaveLength(0);
    expect(result.valid.map((r) => r.gender)).toEqual(['male', 'female', 'male', 'female', 'male', 'female']);
  });
});

describe('parseCustomerFile — mixed real-world birthday formats', () => {
  it('parses Vietnamese "D-thg M" text dates', async () => {
    const file = xlsxFile([
      ['Full Name', 'Email', 'Birthday'],
      ['A', 'a@test.com', '1-thg 1'],
      ['B', 'b@test.com', '14-thg 5'],
      ['C', 'c@test.com', '1-thg 12'],
    ]);
    const result = await parseCustomerFile(file);
    expect(result.errors).toHaveLength(0);
    expect(result.valid.map((r) => r.birthDate)).toEqual(['1900-01-01', '1900-05-14', '1900-12-01']);
  });

  it('parses DD/MM and DD/MM/YYYY text dates', async () => {
    const file = xlsxFile([
      ['Full Name', 'Email', 'Birthday'],
      ['A', 'a@test.com', '17/05'],
      ['B', 'b@test.com', '15/05/1983'],
    ]);
    const result = await parseCustomerFile(file);
    expect(result.errors).toHaveLength(0);
    expect(result.valid.map((r) => r.birthDate)).toEqual(['1900-05-17', '1983-05-15']);
  });

  it('parses genuine Excel date cells', async () => {
    const file = xlsxFile([
      ['Full Name', 'Email', 'Birthday'],
      ['A', 'a@test.com', new Date(1978, 2, 1)], // 1 March 1978
    ]);
    const result = await parseCustomerFile(file);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].birthDate).toBe('1978-03-01');
  });
});
