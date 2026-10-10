import type { ApiFixture, A11yRoute } from "./types";
import { studentFixtures, studentRoutes } from "./student";
import { careerCenterAFixtures, careerCenterARoutes } from "./careerCenterA";
import { careerCenterBFixtures, careerCenterBRoutes } from "./careerCenterB";
import { otherFixtures, otherRoutes } from "./other";

export const allFixtures: ApiFixture[] = [...studentFixtures, ...careerCenterAFixtures, ...careerCenterBFixtures, ...otherFixtures];
export const allRoutes: A11yRoute[] = [...studentRoutes, ...careerCenterARoutes, ...careerCenterBRoutes, ...otherRoutes];
