FROM public.ecr.aws/aws-cli/aws-cli:2.15.30

# The base image ships only the AWS CLI + its bundled runtime -- no
# general-purpose shell tools beyond what the AWS CLI itself needs. Keep it that
# way (guardrail: binary allowlist, not a general-purpose sandbox).
#
# aws-cli:2.x final stage is Amazon Linux 2023, where `yum` is a compatibility
# symlink to `dnf`; `yum install` therefore works. `shadow-utils` provides
# `useradd` and is a no-op if already present.
RUN yum install -y shadow-utils \
    && yum clean all \
    && useradd --create-home --uid 10001 --shell /sbin/nologin sandbox

# The base image's own ENTRYPOINT runs `aws` directly and exits immediately --
# we need a long-lived container that just waits for `docker exec` calls.
ENTRYPOINT []
CMD ["sleep", "infinity"]

USER sandbox
WORKDIR /home/sandbox
