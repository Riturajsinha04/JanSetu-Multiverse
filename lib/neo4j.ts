const NEO4J_HOST = process.env.EXPO_PUBLIC_NEO4J_URI || "https://22dda832.databases.neo4j.io";
const NEO4J_USER = process.env.EXPO_PUBLIC_NEO4J_USERNAME || "22dda832";
const NEO4J_PASSWORD = process.env.EXPO_PUBLIC_NEO4J_PASSWORD || "mqRd7eqHI8RLiSPPINT8q6dN2Hsfv0QHelwfMJZVUGA";
const NEO4J_DATABASE = process.env.EXPO_PUBLIC_NEO4J_DATABASE || "22dda832";

async function runCypher(statement: string, parameters: Record<string, unknown> = {}) {
  const auth = btoa(`${NEO4J_USER}:${NEO4J_PASSWORD}`);
  const url = `${NEO4J_HOST}/db/${NEO4J_DATABASE}/query/v2`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`,
      "Accept": "application/json",
    },
    body: JSON.stringify({ statement, parameters }),
  });

  const body = await res.json();

  if (!res.ok) {
    const msg = body?.errors?.[0]?.message || JSON.stringify(body);
    throw new Error(`Neo4j ${res.status}: ${msg}`);
  }

  const fields: string[] = body.data?.fields ?? [];
  const rows: any[][] = body.data?.values ?? [];

  return rows.map((row) => {
    const obj: Record<string, any> = {};
    fields.forEach((f, i) => {
      const val = row[i];
      if (val && typeof val === "object") {
        const v = val as Record<string, any>;
        obj[f] = v.properties ?? v;
      } else {
        obj[f] = val;
      }
    });
    return obj;
  });
}

async function callProxy<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let result: any;

  switch (action) {
    case "createComplaint": {
      const now = new Date().toISOString();
      await runCypher(`
        MERGE (cit:Citizen {id: $citizenId})
        SET cit.name = $citizenName, cit.phone = $citizenPhone
        CREATE (comp:Complaint {
          id: $complaintId,
          complaint_number: $complaintNumber,
          citizen_name: $citizenName,
          citizen_phone: $citizenPhone,
          raw_text: $rawText,
          language: $language,
          issue_type: $issueType,
          summary: $summary,
          urgency: $urgency,
          department: $department,
          area: $area,
          ward: $ward,
          status: 'PENDING',
          similar_count: 1,
          is_cluster_head: false,
          created_at: $now,
          updated_at: $now
        })
        MERGE (t:IssueType {name: $issueType})
        MERGE (loc:Location {area: $area, ward: $ward})
        MERGE (dept:Department {name: $department})
        CREATE (cit)-[:REPORTED]->(comp)
        CREATE (comp)-[:HAS_TYPE]->(t)
        CREATE (comp)-[:LOCATED_AT]->(loc)
        CREATE (comp)-[:ASSIGNED_TO]->(dept)
      `, {
        citizenId: params.citizenId || `anon_${Date.now()}`,
        citizenName: params.citizenName,
        citizenPhone: params.citizenPhone || "",
        complaintId: params.complaintId,
        complaintNumber: params.complaintNumber,
        rawText: params.rawText,
        language: params.language,
        issueType: params.issueType,
        summary: params.summary,
        urgency: params.urgency,
        department: params.department,
        area: params.area,
        ward: params.ward,
        now,
      });

      // Build SIMILAR_TO relationships with same type + location
      const similar = await runCypher(`
        MATCH (comp:Complaint {id: $complaintId})-[:HAS_TYPE]->(t:IssueType)
        MATCH (comp)-[:LOCATED_AT]->(loc:Location)
        MATCH (other:Complaint)-[:HAS_TYPE]->(t)
        MATCH (other)-[:LOCATED_AT]->(loc)
        WHERE other.id <> $complaintId
        RETURN other.id AS otherId LIMIT 10
      `, { complaintId: params.complaintId });

      if (similar.length > 0) {
        for (const s of similar) {
          await runCypher(`
            MATCH (c1:Complaint {id: $id1}), (c2:Complaint {id: $id2})
            MERGE (c1)-[:SIMILAR_TO]->(c2)
            MERGE (c2)-[:SIMILAR_TO]->(c1)
          `, { id1: params.complaintId, id2: s.otherId as string });
        }
        await runCypher(`
          MATCH (c:Complaint {id: $complaintId})-[:SIMILAR_TO]-(rel:Complaint)
          WITH c, count(rel) + 1 AS total
          SET c.similar_count = total
          WITH c, total
          MATCH (c)-[:SIMILAR_TO]-(rel:Complaint)
          SET rel.similar_count = total
        `, { complaintId: params.complaintId });
      }

      result = { complaint_number: params.complaintNumber };
      break;
    }

    case "getAllComplaints": {
      const rows = await runCypher(`
        MATCH (comp:Complaint)
        RETURN comp
        ORDER BY comp.created_at DESC
        LIMIT 200
      `);
      result = rows.map((r) => r.comp);
      break;
    }

    case "getComplaintByNumber": {
      const rows = await runCypher(`
        MATCH (comp:Complaint {complaint_number: $num})
        RETURN comp
      `, { num: params.complaint_number });

      if (!rows.length) { result = null; break; }

      const comp = rows[0].comp as Record<string, unknown>;
      const simRows = await runCypher(`
        MATCH (c:Complaint {complaint_number: $num})-[:SIMILAR_TO]-(o:Complaint)
        RETURN o LIMIT 5
      `, { num: params.complaint_number });

      result = { ...comp, similar_complaints: simRows.map((r) => r.o) };
      break;
    }

    case "updateStatus": {
      const now = new Date().toISOString();
      await runCypher(`
        MATCH (comp:Complaint {id: $id})
        SET comp.status = $status, comp.updated_at = $now
      `, { id: params.id, status: params.status, now });

      if (params.status === "ESCALATED") {
        await runCypher(`
          MATCH (comp:Complaint {id: $id})
          CREATE (esc:Escalation {reason: 'SLA breach', escalated_at: $now})
          CREATE (comp)-[:ESCALATED_TO]->(esc)
        `, { id: params.id, now });
      }
      result = { success: true };
      break;
    }

    case "getDepartmentStats": {
      const rows = await runCypher(`
        MATCH (dept:Department)<-[:ASSIGNED_TO]-(comp:Complaint)
        WITH dept.name AS name,
             count(comp) AS total,
             sum(CASE WHEN comp.status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved,
             sum(CASE WHEN comp.status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
             sum(CASE WHEN comp.status = 'ESCALATED' THEN 1 ELSE 0 END) AS escalated
        RETURN name, total, resolved, pending, escalated,
               CASE WHEN total > 0 THEN round(resolved * 100.0 / total) ELSE 0 END AS trust_score
        ORDER BY trust_score DESC
      `);
      result = rows.map((r) => ({
        id: r.name,
        name: r.name,
        total_complaints: r.total,
        resolved_complaints: r.resolved,
        pending_count: r.pending,
        escalated_count: r.escalated,
        trust_score: r.trust_score,
        avg_resolution_days: 2.1,
      }));
      break;
    }

    case "getGraphStats": {
      const [tot, clust, esc, spots] = await Promise.all([
        runCypher("MATCH (c:Complaint) RETURN count(c) AS total"),
        runCypher("MATCH (c:Complaint) WHERE c.similar_count > 1 RETURN count(c) AS clustered"),
        runCypher("MATCH (c:Complaint {status:'ESCALATED'}) RETURN count(c) AS escalated"),
        runCypher(`
          MATCH (loc:Location)<-[:LOCATED_AT]-(c:Complaint)
          RETURN loc.area AS area, count(c) AS cnt
          ORDER BY cnt DESC LIMIT 5
        `),
      ]);
      result = {
        total: (tot[0]?.total as number) ?? 0,
        clustered: (clust[0]?.clustered as number) ?? 0,
        escalated: (esc[0]?.escalated as number) ?? 0,
        hotspots: spots,
      };
      break;
    }

    case "runEscalationCheck": {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const rows = await runCypher(`
        MATCH (comp:Complaint)
        WHERE comp.status IN ['PENDING','ASSIGNED'] AND comp.created_at < $cutoff
        SET comp.status = 'ESCALATED', comp.updated_at = $now
        RETURN count(comp) AS count
      `, { cutoff, now: new Date().toISOString() });
      result = { escalated_count: (rows[0]?.count as number) ?? 0 };
      break;
    }

    case "initSchema": {
      for (const q of [
        "CREATE CONSTRAINT complaint_id IF NOT EXISTS FOR (c:Complaint) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT complaint_number IF NOT EXISTS FOR (c:Complaint) REQUIRE c.complaint_number IS UNIQUE",
        "CREATE CONSTRAINT citizen_id IF NOT EXISTS FOR (c:Citizen) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT officer_badge IF NOT EXISTS FOR (o:Officer) REQUIRE o.badge_number IS UNIQUE",
        "CREATE INDEX complaint_status IF NOT EXISTS FOR (c:Complaint) ON (c.status)",
        "CREATE INDEX complaint_area IF NOT EXISTS FOR (c:Complaint) ON (c.area)",
        "CREATE INDEX complaint_dept IF NOT EXISTS FOR (c:Complaint) ON (c.department)",
        "CREATE INDEX officer_dept IF NOT EXISTS FOR (o:Officer) ON (o.department)",
      ]) {
        await runCypher(q).catch(() => {/* already exists */});
      }
      result = { success: true };
      break;
    }

    case "createOfficer": {
      const officerId = `officer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      await runCypher(`
        CREATE (o:Officer {
          id: $id,
          name: $name,
          rank: $rank,
          department: $department,
          badge_number: $badgeNumber,
          phone: $phone,
          ward: $ward,
          is_active: true,
          created_at: $now
        })
        WITH o
        MATCH (dept:Department {name: $department})
        MERGE (o)-[:WORKS_FOR]->(dept)
      `, {
        id: officerId,
        name: params.name,
        rank: params.rank,
        department: params.department,
        badgeNumber: params.badge_number,
        phone: params.phone || "",
        ward: params.ward || "",
        now,
      });
      result = { id: officerId, badge_number: params.badge_number };
      break;
    }

    case "getAllOfficers": {
      const rows = await runCypher(`
        MATCH (o:Officer)
        WHERE o.is_active = true
        RETURN o
        ORDER BY o.department, o.rank
      `);
      result = rows.map((r) => r.o);
      break;
    }

    case "getOfficersByDepartment": {
      const rows = await runCypher(`
        MATCH (o:Officer {department: $dept, is_active: true})
        RETURN o
        ORDER BY o.rank
      `, { dept: params.department });
      result = rows.map((r) => r.o);
      break;
    }

    case "assignOfficer": {
      const now = new Date().toISOString();
      await runCypher(`
        MATCH (comp:Complaint {id: $complaintId})
        MATCH (off:Officer {id: $officerId})
        SET comp.status = 'ASSIGNED', comp.updated_at = $now
        MERGE (comp)-[:HANDLED_BY]->(off)
      `, { complaintId: params.complaintId, officerId: params.officerId, now });
      result = { success: true };
      break;
    }

    case "escalateComplaint": {
      const now = new Date().toISOString();
      await runCypher(`
        MATCH (comp:Complaint {id: $complaintId})
        MATCH (off:Officer {id: $escalationOfficerId})
        SET comp.status = 'ESCALATED', comp.updated_at = $now,
            comp.escalation_reason = $reason, comp.escalation_at = $now
        MERGE (comp)-[:ESCALATED_TO_OFFICER]->(off)
      `, {
        complaintId: params.complaintId,
        escalationOfficerId: params.escalationOfficerId,
        reason: params.reason || "SLA breach",
        now,
      });
      result = { success: true };
      break;
    }

    case "getComplaintWithOfficers": {
      const rows = await runCypher(`
        MATCH (comp:Complaint {complaint_number: $num})
        OPTIONAL MATCH (comp)-[:HANDLED_BY]->(assigned:Officer)
        OPTIONAL MATCH (comp)-[:ESCALATED_TO_OFFICER]->(escalation:Officer)
        RETURN comp, assigned, escalation
      `, { num: params.complaint_number });

      if (!rows.length) { result = null; break; }

      const row = rows[0];
      result = {
        ...row.comp,
        assigned_officer: row.assigned || null,
        escalation_officer: row.escalation || null,
      };
      break;
    }

    case "seedOfficers": {
      result = { seeded: 0 };
      break;
    }

    default:
      throw new Error(`Unknown direct action: ${action}`);
  }

  return result as T;
}

export interface Neo4jComplaint {
  id: string;
  complaint_number: string;
  citizen_name: string;
  citizen_phone?: string;
  raw_text: string;
  language: string;
  issue_type: string;
  summary: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  department: string;
  area: string;
  ward: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
  similar_count: number;
  is_cluster_head: boolean;
  created_at: string;
  updated_at: string;
  similar_complaints?: Neo4jComplaint[];
}

export interface Neo4jDepartment {
  id: string;
  name: string;
  total_complaints: number;
  resolved_complaints: number;
  avg_resolution_days: number;
  pending_count: number;
  escalated_count: number;
  trust_score: number;
}

export interface GraphStats {
  total: number;
  clustered: number;
  escalated: number;
  hotspots: Array<{ area: string; count: number }>;
}

export interface Neo4jOfficer {
  id: string;
  name: string;
  rank: string;
  department: string;
  badge_number: string;
  phone?: string;
  ward?: string;
  is_active: boolean;
  created_at: string;
}

function generateComplaintNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `JS-${dateStr}-${rand}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function createComplaint(data: {
  citizenName: string;
  citizenPhone: string;
  rawText: string;
  language: string;
  issueType: string;
  summary: string;
  urgency: string;
  department: string;
  area: string;
  ward: string;
  userId?: string;
  voiceTranscript?: string;
  llmValidated?: boolean;
  llmConfidence?: string;
  latitude?: number;
  longitude?: number;
}): Promise<string> {
  const complaintId = generateId();
  const complaintNumber = generateComplaintNumber();
  const citizenId = data.userId || `anon_${generateId()}`;

  const result = await callProxy<{ complaint_number: string }>('createComplaint', {
    complaintId,
    complaintNumber,
    citizenId,
    citizenName: data.citizenName,
    citizenPhone: data.citizenPhone,
    rawText: data.rawText,
    language: data.language,
    issueType: data.issueType,
    summary: data.summary,
    urgency: data.urgency,
    department: data.department,
    area: data.area,
    ward: data.ward,
    userId: data.userId || '',
    voiceTranscript: data.voiceTranscript || '',
    llmValidated: data.llmValidated || false,
    llmConfidence: data.llmConfidence || '',
    latitude: data.latitude,
    longitude: data.longitude,
  });

  return result.complaint_number;
}

export async function getAllComplaints(): Promise<Neo4jComplaint[]> {
  return callProxy<Neo4jComplaint[]>('getAllComplaints');
}

export async function getComplaintByNumber(complaintNumber: string): Promise<Neo4jComplaint | null> {
  return callProxy<Neo4jComplaint | null>('getComplaintByNumber', { complaint_number: complaintNumber });
}

export async function updateComplaintStatus(id: string, status: string): Promise<void> {
  await callProxy('updateStatus', { id, status });
}

export async function getDepartmentStats(): Promise<Neo4jDepartment[]> {
  return callProxy<Neo4jDepartment[]>('getDepartmentStats');
}

export async function getGraphStats(): Promise<GraphStats> {
  return callProxy<GraphStats>('getGraphStats');
}

export async function runEscalationCheck(): Promise<{ escalated_count: number }> {
  return callProxy<{ escalated_count: number }>('runEscalationCheck');
}

export async function initNeo4jSchema(): Promise<void> {
  await callProxy('initSchema');
  // Also seed officers and departments if needed
  await callProxy('seedOfficers').catch(() => {/* already seeded */});
}

// Officer management functions
export async function createOfficer(data: {
  name: string;
  rank: string;
  department: string;
  badge_number: string;
  phone?: string;
  ward?: string;
}): Promise<{ id: string; badge_number: string }> {
  return callProxy<{ id: string; badge_number: string }>('createOfficer', {
    name: data.name,
    rank: data.rank,
    department: data.department,
    badge_number: data.badge_number,
    phone: data.phone || '',
    ward: data.ward || '',
  });
}

export async function getAllOfficers(): Promise<Neo4jOfficer[]> {
  return callProxy<Neo4jOfficer[]>('getAllOfficers');
}

export async function getOfficersByDepartment(department: string): Promise<Neo4jOfficer[]> {
  return callProxy<Neo4jOfficer[]>('getOfficersByDepartment', { department });
}

export async function assignOfficerToComplaint(complaintId: string, officerId: string): Promise<void> {
  await callProxy('assignOfficer', { complaintId, officerId });
}

export async function escalateComplaintToOfficer(
  complaintId: string,
  escalationOfficerId: string,
  reason?: string
): Promise<void> {
  await callProxy('escalateComplaint', {
    complaintId,
    escalationOfficerId,
    reason: reason || 'SLA breach',
  });
}

export async function getComplaintWithOfficers(complaintNumber: string): Promise<{
  complaint: Neo4jComplaint;
  assigned_officer: Neo4jOfficer | null;
  escalation_officer: Neo4jOfficer | null;
} | null> {
  const result = await callProxy<{
    id: string;
    complaint_number: string;
    citizen_name: string;
    raw_text: string;
    language: string;
    issue_type: string;
    summary: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    department: string;
    area: string;
    ward: string;
    status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
    similar_count: number;
    is_cluster_head: boolean;
    created_at: string;
    updated_at: string;
    assigned_officer: Neo4jOfficer | null;
    escalation_officer: Neo4jOfficer | null;
  } | null>('getComplaintWithOfficers', { complaint_number: complaintNumber });

  if (!result) return null;

  const { assigned_officer, escalation_officer, ...complaintData } = result;
  return {
    complaint: complaintData as Neo4jComplaint,
    assigned_officer,
    escalation_officer,
  };
}

export async function seedOfficers(): Promise<{ seeded: number }> {
  return callProxy<{ seeded: number }>('seedOfficers');
}
