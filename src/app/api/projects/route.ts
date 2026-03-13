import { NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/projects";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const project = createProject(body.name || "New Project");
  return NextResponse.json(project);
}
