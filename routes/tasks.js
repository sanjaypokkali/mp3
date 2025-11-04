var Task = require('../models/task')
var User = require('../models/user')

module.exports = (router) => {

    var taskRoute = router.route("/tasks")
    var singleTaskRoute = router.route("/tasks/:id")

    taskRoute.get((req, res) => {
        try {
            // Parse where filter first (used for both find and count)
            let whereFilter = {};
            if (req.query.where) {
                try {
                    whereFilter = JSON.parse(req.query.where);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'where' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            // Handle 'count' parameter - count only uses where filter
            if (req.query.count === 'true') {
                Task.countDocuments(whereFilter).exec((err, count) => {
                    if (err) {
                        return res.status(500).json({
                            message: "Server error occurred while counting tasks.",
                            data: {}
                        });
                    }
                    return res.status(200).json({
                        message: "OK",
                        data: count
                    });
                });
                return;
            }

            // Build the query using Mongoose methods for find operations
            let query = Task.find(whereFilter);

            // Handle 'sort' parameter
            if (req.query.sort) {
                try {
                    const sortObj = JSON.parse(req.query.sort);
                    query = query.sort(sortObj);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'sort' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            // Handle 'select' parameter
            if (req.query.select) {
                try {
                    const selectObj = JSON.parse(req.query.select);
                    query = query.select(selectObj);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'select' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            // Handle 'skip' parameter
            if (req.query.skip) {
                const skip = parseInt(req.query.skip);
                if (isNaN(skip) || skip < 0) {
                    return res.status(400).json({
                        message: "Invalid 'skip' parameter. Must be a non-negative integer.",
                        data: {}
                    });
                }
                query = query.skip(skip);
            }

            // Handle 'limit' parameter (default 100 for tasks)
            if (req.query.limit) {
                const limit = parseInt(req.query.limit);
                if (isNaN(limit) || limit < 0) {
                    return res.status(400).json({
                        message: "Invalid 'limit' parameter. Must be a non-negative integer.",
                        data: {}
                    });
                }
                query = query.limit(limit);
            } else {
                // Default limit of 100 for tasks
                query = query.limit(100);
            }

            // Execute the query and return results
            query.exec((err, tasks) => {
                if (err) {
                    return res.status(500).json({
                        message: "Server error occurred while retrieving tasks.",
                        data: {}
                    });
                }
                return res.status(200).json({
                    message: "OK",
                    data: tasks
                });
            });
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    taskRoute.post((req, res) => {
        try {
            // Validate required fields
            if (!req.body.name || req.body.name.trim() === '') {
                return res.status(400).json({
                    message: "Task name is required.",
                    data: {}
                });
            }

            if (!req.body.deadline) {
                return res.status(400).json({
                    message: "Task deadline is required.",
                    data: {}
                });
            }

            // Create new task object with provided fields and defaults
            const taskData = {
                name: req.body.name.trim(),
                deadline: req.body.deadline
            };

            // Set default values for fields not specified
            if (req.body.description !== undefined) {
                taskData.description = req.body.description;
            } else {
                taskData.description = "";
            }

            if (req.body.completed !== undefined) {
                taskData.completed = req.body.completed;
            } else {
                taskData.completed = false;
            }

            if (req.body.assignedUser !== undefined && req.body.assignedUser !== "") {
                taskData.assignedUser = req.body.assignedUser;

                // Need to get the user's name
                User.findById(req.body.assignedUser, (err, user) => {
                    if (err || !user) {
                        return res.status(400).json({
                            message: "User not found.",
                            data: {}
                        });
                    } else {
                        if (user && req.body.assignedUserName !== undefined && req.body.assignedUserName !== "" && req.body.assignedUserName !== user.name) {
                            return res.status(400).json({
                                message: "Assigned user name does not match the user's name.",
                                data: {}
                            });   
                        }
                        taskData.assignedUserName = req.body.assignedUserName;
                    }    
                });
            }
            else {
                taskData.assignedUser = "";
                taskData.assignedUserName = "unassigned";
            }
            createTask();

            function createTask() {
                const newTask = new Task(taskData);
                newTask.save((err, task) => {
                    if (err) {
                        return res.status(500).json({
                            message: "Server error occurred while creating task.",
                            data: {}
                        });
                    }

                    if (task.assignedUser && task.assignedUser !== "") {
                        User.findByIdAndUpdate(
                            task.assignedUser,
                            { $addToSet: { pendingTasks: task._id.toString() } },
                            (err, user) => {
                                return res.status(201).json({
                                    message: "OK",
                                    data: task
                                });
                            }
                        );
                    } else {
                        return res.status(201).json({
                            message: "OK",
                            data: task
                        });
                    }
                });
            }
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    singleTaskRoute.get((req, res) => {
        try {
            let query = Task.findById(req.params.id);

            if (req.query.select) {
                try {
                    const selectObj = JSON.parse(req.query.select);
                    query = query.select(selectObj);
                } catch (err) {
                    return res.status(400).json({
                        message: "Invalid 'select' parameter. Must be valid JSON.",
                        data: {}
                    });
                }
            }

            query.exec((err, task) => {
                if (err) {
                    if (err.name === 'CastError') {
                        return res.status(404).json({
                            message: "Task not found.",
                            data: {}
                        });
                    }
                    return res.status(500).json({
                        message: "Server error occurred while retrieving task.",
                        data: {}
                    });
                }

                if (!task) {
                    return res.status(404).json({
                        message: "Task not found.",
                        data: {}
                    });
                }

                return res.status(200).json({
                    message: "OK",
                    data: task
                });
            });
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    singleTaskRoute.put((req, res) => {
        try {
            if (!req.body.name || req.body.name.trim() === '') {
                return res.status(400).json({
                    message: "Task name is required.",
                    data: {}
                });
            }

            if (!req.body.deadline) {
                return res.status(400).json({
                    message: "Task deadline is required.",
                    data: {}
                });
            }

            // First, find the existing task to get its old assignedUser
            Task.findById(req.params.id, (err, existingTask) => {
                if (err) {
                    if (err.name === 'CastError') {
                        return res.status(404).json({
                            message: "Task not found.",
                            data: {}
                        });
                    }
                    return res.status(500).json({
                        message: "Server error occurred while retrieving task.",
                        data: {}
                    });
                }

                if (!existingTask) {
                    return res.status(404).json({
                        message: "Task not found.",
                        data: {}
                    });
                }

                const oldAssignedUser = existingTask.assignedUser || "";
                const oldCompleted = existingTask.completed || false;

                // Build update data
                const updateData = {
                    name: req.body.name.trim(),
                    deadline: req.body.deadline
                };

                // Set default values for fields not specified
                if (req.body.description !== undefined) {
                    updateData.description = req.body.description;
                } else {
                    updateData.description = "";
                }

                if (req.body.completed !== undefined) {
                    updateData.completed = req.body.completed;
                } else {
                    updateData.completed = false;
                }

                if (req.body.assignedUser !== undefined && req.body.assignedUser !== "") {
                    updateData.assignedUser = req.body.assignedUser;
                    // Need to get the user's name
                    User.findById(req.body.assignedUser, (err, user) => {
                        if (err || !user) {
                            return res.status(400).json({
                                message: "User not found.",
                                data: {}
                            });
                        } else {
                            updateData.assignedUserName = user.name;
                            performUpdate();
                        }
                    });
                } else {
                    updateData.assignedUser = "";
                    updateData.assignedUserName = "unassigned";
                    performUpdate();
                }

                function performUpdate() {
                    // Replace entire task
                    Task.findByIdAndUpdate(
                        req.params.id,
                        updateData,
                        { new: true, runValidators: true },
                        (err, updatedTask) => {
                            if (err) {
                                if (err.name === 'CastError') {
                                    return res.status(404).json({
                                        message: "Task not found.",
                                        data: {}
                                    });
                                }
                                return res.status(500).json({
                                    message: "Server error occurred while updating task.",
                                    data: {}
                                });
                            }

                            if (!updatedTask) {
                                return res.status(404).json({
                                    message: "Task not found.",
                                    data: {}
                                });
                            }

                            // Maintain two-way reference: update users' pendingTasks
                            // pendingTasks should only contain IDs of tasks that are assigned and not completed
                            const taskIdStr = updatedTask._id.toString();
                            const newCompleted = updatedTask.completed || false;
                            const newAssignedUser = updatedTask.assignedUser || "";

                            // Handle assignment changes
                            if (oldAssignedUser && oldAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                                // Task was reassigned: remove from old user's pendingTasks (only if it was pending)
                                if (!oldCompleted) {
                                    User.findByIdAndUpdate(
                                        oldAssignedUser,
                                        { $pull: { pendingTasks: taskIdStr } },
                                        (err) => {
                                            // Continue even if error
                                        }
                                    );
                                }
                            }

                            // Handle assignment changes or new assignment
                            if (newAssignedUser && newAssignedUser !== "" && newAssignedUser !== oldAssignedUser) {
                                // Task assigned to new user: add to pendingTasks only if not completed
                                if (!newCompleted) {
                                    User.findByIdAndUpdate(
                                        newAssignedUser,
                                        { $addToSet: { pendingTasks: taskIdStr } },
                                        (err) => {
                                            // Continue even if error
                                        }
                                    );
                                }
                            }

                            // Handle completed status changes for tasks that haven't been reassigned
                            // If task is assigned to the same user and completed status changed
                            if (newAssignedUser && newAssignedUser !== "" && newAssignedUser === oldAssignedUser) {
                                if (oldCompleted !== newCompleted) {
                                    if (newCompleted) {
                                        // Task completed: remove from pendingTasks
                                        User.findByIdAndUpdate(
                                            newAssignedUser,
                                            { $pull: { pendingTasks: taskIdStr } },
                                            (err) => {
                                                // Continue even if error
                                            }
                                        );
                                    } else {
                                        // Task uncompleted: add back to pendingTasks
                                        User.findByIdAndUpdate(
                                            newAssignedUser,
                                            { $addToSet: { pendingTasks: taskIdStr } },
                                            (err) => {
                                                // Continue even if error
                                            }
                                        );
                                    }
                                }
                            }

                            return res.status(200).json({
                                message: "OK",
                                data: updatedTask
                            });
                        }
                    );
                }
            });
        } catch (err) {
            return res.status(500).json({
                message: "Server error occurred while processing request.",
                data: {}
            });
        }
    })

    singleTaskRoute.delete((req, res) => {
        Task.findByIdAndDelete(req.params.id, (err, task) => {
            if (err) {
                if (err.name === 'CastError') {
                    return res.status(404).json({
                        message: "Task not found.",
                        data: {}
                    });
                }
                return res.status(500).json({
                    message: "Server error occurred while deleting task.",
                    data: {}
                });
            } else if (!task) {
                return res.status(404).json({
                    message: "Task not found.",
                    data: {}
                });
            }

            // Remove task from assigned user's pendingTasks (maintain two-way reference)
            if (task.assignedUser && task.assignedUser !== "") {
                User.findByIdAndUpdate(
                    task.assignedUser,
                    { $pull: { pendingTasks: task._id.toString() } },
                    (err, result) => {
                        return res.status(204).send();
                    }
                );
            } else {
                return res.status(204).send();
            }
        });
    })

    return router
}