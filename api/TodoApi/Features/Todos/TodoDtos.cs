using System.ComponentModel.DataAnnotations;
using TodoApi.Domain;

namespace TodoApi.Features.Todos;

public sealed record CreateTodoRequest(
    [property: Required, StringLength(200)] string Title,
    [property: StringLength(2000)] string? Notes);

public sealed record UpdateTodoRequest(
    [property: Required, StringLength(200)] string Title,
    [property: StringLength(2000)] string? Notes);

/// <summary>Nullable + Required so that a missing field is a 400 rather than silently meaning "false".</summary>
public sealed record SetCompletedRequest([property: Required] bool? IsCompleted);

public sealed record TodoResponse(
    Guid Id,
    string Title,
    string? Notes,
    bool IsCompleted,
    DateTime? CompletedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static TodoResponse From(TodoItem t) =>
        new(t.Id, t.Title, t.Notes, t.IsCompleted, t.CompletedAt, t.CreatedAt, t.UpdatedAt);
}

public sealed record ClearCompletedResponse(int Deleted);
