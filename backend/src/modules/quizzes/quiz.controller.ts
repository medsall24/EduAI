import { Request, Response, NextFunction } from "express";
import {
  createQuizSchema,
  updateQuizSchema,
  lessonIdSchema,
  quizIdSchema,
  createQuestionSchema,
  updateQuestionSchema,
  questionIdSchema,
  createOptionSchema,
  updateOptionSchema,
  optionIdSchema,
  submitQuizSchema,
  attemptIdSchema,

} from "./quiz.schema.js";
import {
  createQuiz,
  listQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  createQuestion,
  listQuestions,
  updateQuestion,
  deleteQuestion,
  createOption,
  listOptions,
  updateOption,
  deleteOption,
  startQuizAttempt,
  submitQuizAttempt,

} from "./quiz.service.js";

/**
 * CrÃ©e un nouveau Quiz pour une Lesson.
 */
export async function createQuizController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant de la Lesson.
    const lessonValidation = lessonIdSchema.safeParse(req.params);

    if (!lessonValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
        errors: lessonValidation.error.flatten(),
      });
    }

    // Validation des donnÃ©es reÃ§ues dans le body.
    const bodyValidation = createQuizSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz data",
        errors: bodyValidation.error.flatten(),
      });
    }

    // Le tenantId provient exclusivement de l'utilisateur authentifiÃ©.
    const tenantId = req.user?.tenantId ?? null;

    const quiz = await createQuiz(
  {
    userId: req.user?.userId ?? "",
    tenantId,
    roleId: req.user?.roleId ?? null,
    systemRole: req.user?.systemRole ?? null,
  },
  lessonValidation.data.lessonId,
  bodyValidation.data,
);

    return res.status(201).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retourne tous les Quiz d'une Lesson.
 */
export async function listQuizzesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant de la Lesson.
    const validation = lessonIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
        errors: validation.error.flatten(),
      });
    }

    const tenantId = req.user?.tenantId ?? null;

    const quizzes = await listQuizzes(
  {
    userId: req.user?.userId ?? "",
    tenantId,
    roleId: req.user?.roleId ?? null,
    systemRole: req.user?.systemRole ?? null,
  },
  validation.data.lessonId,
);

    return res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retourne un Quiz par son identifiant.
 */
export async function getQuizController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant du Quiz.
    const validation = quizIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
        errors: validation.error.flatten(),
      });
    }
   const tenantId = req.user?.tenantId ?? null;
   const quiz = await getQuiz(
  {
    userId: req.user?.userId ?? "",
    tenantId,
    roleId: req.user?.roleId ?? null,
    systemRole: req.user?.systemRole ?? null,
  },
  validation.data.quizId,
);

    return res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Modifie un Quiz existant.
 */
export async function updateQuizController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant du Quiz.
    const idValidation = quizIdSchema.safeParse(req.params);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
        errors: idValidation.error.flatten(),
      });
    }

    // Validation des donnÃ©es Ã  modifier.
    const bodyValidation = updateQuizSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const tenantId = req.user?.tenantId ?? null;

    const quiz = await updateQuiz(
  {
    userId: req.user?.userId ?? "",
    tenantId,
    roleId: req.user?.roleId ?? null,
    systemRole: req.user?.systemRole ?? null,
  },
  idValidation.data.quizId,
  bodyValidation.data,
);

    return res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime un Quiz.
 */
export async function deleteQuizController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant du Quiz.
    const validation = quizIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
        errors: validation.error.flatten(),
      });
    }

    const tenantId = req.user?.tenantId ?? null;

    await deleteQuiz(
  {
    userId: req.user?.userId ?? "",
    tenantId,
    roleId: req.user?.roleId ?? null,
    systemRole: req.user?.systemRole ?? null,
  },
  validation.data.quizId,
);

    return res.status(200).json({
      success: true,
      message: "Quiz deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * CrÃ©e une nouvelle Question dans un Quiz.
 */
export async function createQuestionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const quizValidation = quizIdSchema.safeParse(req.params);

    if (!quizValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
        errors: quizValidation.error.flatten(),
      });
    }

    const bodyValidation = createQuestionSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid question data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const question = await createQuestion(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      quizValidation.data.quizId,
      bodyValidation.data,
    );

    return res.status(201).json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retourne toutes les Questions d'un Quiz.
 */
export async function listQuestionsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = quizIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
        errors: validation.error.flatten(),
      });
    }

    const questions = await listQuestions(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      validation.data.quizId,
    );

    return res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Modifie une Question existante.
 */
export async function updateQuestionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const idValidation = questionIdSchema.safeParse(req.params);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID",
        errors: idValidation.error.flatten(),
      });
    }

    const bodyValidation = updateQuestionSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid question data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const question = await updateQuestion(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      idValidation.data.questionId,
      bodyValidation.data,
    );

    return res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime une Question.
 */
export async function deleteQuestionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = questionIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID",
        errors: validation.error.flatten(),
      });
    }

    await deleteQuestion(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      validation.data.questionId,
    );

    return res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}


/**
 * CrÃ©e une option pour une question.
 *
 * VÃ©rifie l'identifiant de la question et les donnÃ©es reÃ§ues,
 * puis dÃ©lÃ¨gue la crÃ©ation au service.
 */
export async function createOptionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Valide l'identifiant de la question transmis dans l'URL.
    const questionValidation = questionIdSchema.safeParse(req.params);

    if (!questionValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID",
        errors: questionValidation.error.flatten(),
      });
    }

    // Valide le texte, la position et la correction Ã©ventuelle de l'option.
    const bodyValidation = createOptionSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid option data",
        errors: bodyValidation.error.flatten(),
      });
    }

    // Le contexte du tenant et les rÃ´les proviennent du JWT authentifiÃ©.
    const option = await createOption(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      questionValidation.data.questionId,
      bodyValidation.data,
    );

    // Une option crÃ©Ã©e est retournÃ©e avec le statut HTTP 201.
    return res.status(201).json({
      success: true,
      data: option,
    });
  } catch (error) {
    // Transmet les erreurs au gestionnaire central d'erreurs.
    next(error);
  }
}

/**
 * Retourne les options d'une question.
 *
 * Le service applique l'isolation du tenant et masque les corrections
 * lorsque l'utilisateur n'est pas autorisÃ© Ã  les consulter.
 */
export async function listOptionsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // VÃ©rifie que l'identifiant de la question est un UUID valide.
    const validation = questionIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID",
        errors: validation.error.flatten(),
      });
    }

    // RÃ©cupÃ¨re les options dans le contexte du tenant authentifiÃ©.
    const options = await listOptions(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      validation.data.questionId,
    );

    // Retourne la liste des options.
    return res.status(200).json({
      success: true,
      data: options,
    });
  } catch (error) {
    // Transmet les erreurs au gestionnaire central d'erreurs.
    next(error);
  }
}

/**
 * Modifie une option existante.
 *
 * Seuls les champs validÃ©s par updateOptionSchema peuvent Ãªtre modifiÃ©s.
 */
export async function updateOptionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Valide l'identifiant de l'option prÃ©sent dans l'URL.
    const idValidation = optionIdSchema.safeParse(req.params);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid option ID",
        errors: idValidation.error.flatten(),
      });
    }

    // VÃ©rifie les champs Ã  modifier.
    const bodyValidation = updateOptionSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid option data",
        errors: bodyValidation.error.flatten(),
      });
    }

    // Transmet au service l'option et les donnÃ©es validÃ©es.
    const option = await updateOption(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      idValidation.data.optionId,
      bodyValidation.data,
    );

    // Retourne l'option mise Ã  jour.
    return res.status(200).json({
      success: true,
      data: option,
    });
  } catch (error) {
    // Transmet les erreurs au gestionnaire central d'erreurs.
    next(error);
  }
}

/**
 * Supprime une option existante.
 *
 * Le service vÃ©rifie que l'option appartient au tenant courant
 * avant d'effectuer la suppression.
 */
export async function deleteOptionController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Valide l'identifiant de l'option Ã  supprimer.
    const validation = optionIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid option ID",
        errors: validation.error.flatten(),
      });
    }

    // Supprime l'option dans le contexte du tenant authentifiÃ©.
    await deleteOption(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      validation.data.optionId,
    );

    // Confirme la suppression.
    return res.status(200).json({
      success: true,
      message: "Option deleted successfully",
    });
  } catch (error) {
    // Transmet les erreurs au gestionnaire central d'erreurs.
    next(error);
  }
}


/**
 * Démarre une nouvelle tentative de quiz pour l'utilisateur authentifié.
 */
export async function startQuizAttemptController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = quizIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID",
        errors: validation.error.flatten(),
      });
    }

    const attempt = await startQuizAttempt(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      validation.data.quizId,
    );

    return res.status(201).json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Soumet les réponses d'une tentative de quiz.
 */
export async function submitQuizAttemptController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Vérifie l'identifiant de la tentative.
    const paramsValidation = attemptIdSchema.safeParse(req.params);

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID",
        errors: paramsValidation.error.flatten(),
      });
    }

    // Valide les réponses envoyées par l'apprenant.
    const bodyValidation = submitQuizSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz submission",
        errors: bodyValidation.error.flatten(),
      });
    }

    // Le contexte est issu de l'utilisateur authentifié.
    const result = await submitQuizAttempt(
      {
        userId: req.user?.userId ?? "",
        tenantId: req.user?.tenantId ?? null,
        roleId: req.user?.roleId ?? null,
        systemRole: req.user?.systemRole ?? null,
      },
      paramsValidation.data.attemptId,
      bodyValidation.data,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


